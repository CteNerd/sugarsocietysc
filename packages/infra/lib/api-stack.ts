import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as eventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import * as path from 'path';
import { EnvConfig } from './env-config';

export interface ApiStackProps extends StackProps {
  vpc: ec2.Vpc;
  lambdaSecurityGroup: ec2.SecurityGroup;
  cluster: rds.DatabaseCluster;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
}

/**
 * HTTP API (cheaper than REST API, native JWT authorizer support for Cognito)
 * fronting NodejsFunctions for the API domains and scheduled/queue-driven maintenance workers.
 */
export class ApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, envConfig: EnvConfig, props: ApiStackProps) {
    super(scope, id, props);

    // NOTE: the DB credentials secret is resolved at runtime (not synth time).
    // Phase 1 adds a small bootstrap in packages/api that reads DB_SECRET_ARN via the
    // Secrets Manager SDK and builds the pg connection string from it.
    const commonFnProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.seconds(10),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSecurityGroup],
    };
    const commonEnv = {
      DB_SECRET_ARN: props.cluster.secret?.secretArn ?? '',
      DB_HOST: props.cluster.clusterEndpoint.hostname,
      DB_PORT: props.cluster.clusterEndpoint.port.toString(),
      DB_NAME: 'sugarsocietysc',
      GUEST_PII_RETENTION_DAYS: envConfig.guestPiiRetentionDays.toString(),
      SMS_PROVIDER: 'sns',
      NEWSLETTER_FROM_EMAIL: process.env.NEWSLETTER_FROM_EMAIL ?? '',
      NEWSLETTER_SITE_URL: `https://${envConfig.domainName}`,
      NEWSLETTER_SIGNATURE: process.env.NEWSLETTER_SIGNATURE || 'Sugar Society Sugar Cookies',
      COGNITO_ISSUER_URL: props.userPool.userPoolProviderUrl,
      COGNITO_CLIENT_ID: props.userPoolClient.userPoolClientId,
    };
    const functionLogGroup = (name: string) => new logs.LogGroup(this, `${name}Logs`, {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: envConfig.envName === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // Alarm notifications: SNS subscribes a human email per environment — AWS sends a confirmation
    // email on first deploy, which must be accepted before notifications are delivered.
    const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: `sugarsocietysc-${envConfig.envName}-alarms`,
      displayName: `Sugar Society SC (${envConfig.envName}) alarms`,
    });
    alarmTopic.addSubscription(new subscriptions.EmailSubscription(envConfig.alertEmail));
    const alarmAction = new cloudwatchActions.SnsAction(alarmTopic);

    const healthFn = new lambdaNode.NodejsFunction(this, 'HealthFn', {
      entry: path.join(__dirname, '../../api/src/lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      logGroup: functionLogGroup('HealthFn'),
      environment: commonEnv,
    });
    props.cluster.secret?.grantRead(healthFn);

    // Not wired to any HTTP route or trigger — Aurora lives in a private isolated subnet with no
    // route from outside AWS, so this is the only way to apply `node-pg-migrate` migrations to a
    // deployed environment. Invoke manually via `aws lambda invoke` after deploying new migrations
    // (see README "Deploying to AWS").
    const migrateFn = new lambdaNode.NodejsFunction(this, 'MigrateFn', {
      entry: path.join(__dirname, '../../api/src/migrate-lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      logGroup: functionLogGroup('MigrateFn'),
      timeout: Duration.seconds(60),
      environment: commonEnv,
      bundling: {
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling: (inputDir: string, outputDir: string) => [
            `cp -r ${inputDir}/packages/api/migrations ${outputDir}/migrations`,
          ],
        },
      },
    });
    props.cluster.secret?.grantRead(migrateFn);

    // One-off demo-data seeder, same rationale/invocation pattern as MigrateFn — run after
    // migrations whenever a deployed environment needs the Halloween Pre-Sale catalog populated.
    const seedFn = new lambdaNode.NodejsFunction(this, 'SeedFn', {
      entry: path.join(__dirname, '../../api/src/seed-lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      logGroup: functionLogGroup('SeedFn'),
      timeout: Duration.seconds(60),
      environment: commonEnv,
    });
    props.cluster.secret?.grantRead(seedFn);

    const newsletterDeadLetterQueue = new sqs.Queue(this, 'NewsletterDeadLetterQueue', {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(14),
    });
    const newsletterQueue = new sqs.Queue(this, 'NewsletterQueue', {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(4),
      visibilityTimeout: Duration.seconds(360),
      deadLetterQueue: {
        queue: newsletterDeadLetterQueue,
        maxReceiveCount: 5,
      },
    });

    const guestPiiRetentionFn = new lambdaNode.NodejsFunction(this, 'GuestPiiRetentionFn', {
      entry: path.join(__dirname, '../../api/src/guest-pii-retention-lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      logGroup: functionLogGroup('GuestPiiRetentionFn'),
      timeout: Duration.seconds(60),
      environment: commonEnv,
    });
    props.cluster.secret?.grantRead(guestPiiRetentionFn);
    new events.Rule(this, 'GuestPiiRetentionSchedule', {
      description: `Purge guest contact details after ${envConfig.guestPiiRetentionDays} days in terminal order states`,
      schedule: events.Schedule.cron({ minute: '0', hour: '3' }),
      targets: [new targets.LambdaFunction(guestPiiRetentionFn)],
    });
    const inventoryHoldExpiryFn = new lambdaNode.NodejsFunction(this, 'InventoryHoldExpiryFn', {
      entry: path.join(__dirname, '../../api/src/inventory-hold-expiry-lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      logGroup: functionLogGroup('InventoryHoldExpiryFn'),
      timeout: Duration.seconds(60),
      environment: commonEnv,
    });
    props.cluster.secret?.grantRead(inventoryHoldExpiryFn);
    new events.Rule(this, 'InventoryHoldExpirySchedule', {
      description: 'Release cookie inventory held by unpaid checkouts after 30 minutes',
      schedule: events.Schedule.rate(Duration.minutes(5)),
      targets: [new targets.LambdaFunction(inventoryHoldExpiryFn)],
    });
    const inventoryHoldExpiryErrorsAlarm = new cloudwatch.Alarm(this, 'InventoryHoldExpiryErrorsAlarm', {
      alarmDescription: 'Investigate failures in the scheduled unpaid inventory hold expiry job.',
      metric: inventoryHoldExpiryFn.metricErrors({ period: Duration.minutes(5), statistic: 'Sum' }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    inventoryHoldExpiryErrorsAlarm.addAlarmAction(alarmAction);
    const guestPiiRetentionErrorsAlarm = new cloudwatch.Alarm(this, 'GuestPiiRetentionErrorsAlarm', {
      alarmDescription: 'Investigate failures in the scheduled guest-contact purge.',
      metric: guestPiiRetentionFn.metricErrors({ period: Duration.minutes(5), statistic: 'Sum' }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    guestPiiRetentionErrorsAlarm.addAlarmAction(alarmAction);

    const authSyncFn = new lambdaNode.NodejsFunction(this, 'AuthSyncFn', {
      entry: path.join(__dirname, '../../api/src/lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      logGroup: functionLogGroup('AuthSyncFn'),
      environment: commonEnv,
    });
    props.cluster.secret?.grantRead(authSyncFn);

    const newsletterFn = new lambdaNode.NodejsFunction(this, 'NewsletterFn', {
      entry: path.join(__dirname, '../../api/src/lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      logGroup: functionLogGroup('NewsletterFn'),
      environment: { ...commonEnv, NEWSLETTER_QUEUE_URL: newsletterQueue.queueUrl },
    });
    props.cluster.secret?.grantRead(newsletterFn);
    newsletterQueue.grantSendMessages(newsletterFn);

    const newsletterWorkerFn = new lambdaNode.NodejsFunction(this, 'NewsletterWorkerFn', {
      entry: path.join(__dirname, '../../api/src/domains/newsletter/newsletter-worker.ts'),
      handler: 'handler',
      ...commonFnProps,
      logGroup: functionLogGroup('NewsletterWorkerFn'),
      timeout: Duration.seconds(60),
      environment: { ...commonEnv, NEWSLETTER_QUEUE_URL: newsletterQueue.queueUrl },
    });
    props.cluster.secret?.grantRead(newsletterWorkerFn);
    newsletterQueue.grantConsumeMessages(newsletterWorkerFn);
    newsletterWorkerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail'],
      resources: ['*'],
    }));
    newsletterWorkerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sns:Publish'],
      resources: ['*'],
    }));
    newsletterWorkerFn.addEventSource(new eventSources.SqsEventSource(newsletterQueue, {
      batchSize: 10,
      reportBatchItemFailures: true,
    }));
    const newsletterWorkerErrorsAlarm = new cloudwatch.Alarm(this, 'NewsletterWorkerErrorsAlarm', {
      alarmDescription: 'Investigate newsletter delivery worker failures and inspect the SQS dead-letter queue.',
      metric: newsletterWorkerFn.metricErrors({ period: Duration.minutes(5), statistic: 'Sum' }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    newsletterWorkerErrorsAlarm.addAlarmAction(alarmAction);
    const newsletterDeadLetterQueueAlarm = new cloudwatch.Alarm(this, 'NewsletterDeadLetterQueueAlarm', {
      alarmDescription: 'Redrive or investigate failed newsletter messages before retrying the campaign.',
      metric: newsletterDeadLetterQueue.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(5),
        statistic: 'Maximum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    newsletterDeadLetterQueueAlarm.addAlarmAction(alarmAction);

    const catalogFn = new lambdaNode.NodejsFunction(this, 'CatalogFn', {
      entry: path.join(__dirname, '../../api/src/lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      logGroup: functionLogGroup('CatalogFn'),
      environment: commonEnv,
    });
    props.cluster.secret?.grantRead(catalogFn);

    // Populated out-of-band by a human (real Stripe API keys can't be generated/committed by CDK) —
    // see packages/api/src/config/stripe-secret.ts and docs/ROADMAP.md deployment checkpoint.
    const stripeSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'StripeSecret',
      `sugarsocietysc/${envConfig.envName}/stripe`,
    );
    const stripeEnv = { ...commonEnv, STRIPE_SECRET_ARN: stripeSecret.secretArn };

    const ordersFn = new lambdaNode.NodejsFunction(this, 'OrdersFn', {
      entry: path.join(__dirname, '../../api/src/lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      logGroup: functionLogGroup('OrdersFn'),
      environment: stripeEnv,
    });
    props.cluster.secret?.grantRead(ordersFn);
    stripeSecret.grantRead(ordersFn);

    const webhooksStripeFn = new lambdaNode.NodejsFunction(this, 'WebhooksStripeFn', {
      entry: path.join(__dirname, '../../api/src/lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      logGroup: functionLogGroup('WebhooksStripeFn'),
      environment: stripeEnv,
    });
    props.cluster.secret?.grantRead(webhooksStripeFn);
    stripeSecret.grantRead(webhooksStripeFn);

    this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: `sugarsocietysc-${envConfig.envName}`,
      createDefaultStage: false,
      corsPreflight: {
        allowOrigins: [`https://${envConfig.domainName}`],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.PATCH],
        allowHeaders: ['Authorization', 'Content-Type'],
      },
    });
    // Account-level API Gateway throttling is a shared default across the whole AWS account — an
    // explicit per-stage limit here caps abuse/runaway-automation traffic to this API specifically,
    // ahead of exposing it to more automated/MCP-style callers.
    new apigwv2.HttpStage(this, 'HttpApiDefaultStage', {
      httpApi: this.httpApi,
      stageName: '$default',
      autoDeploy: true,
      throttle: { rateLimit: 50, burstLimit: 100 },
    });

    this.httpApi.addRoutes({
      path: '/health',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('HealthIntegration', healthFn),
    });

    // Cognito JWT authorizer: defense-in-depth at the API Gateway edge for deployed environments.
    // Local dev (no API Gateway) validates the same JWTs in application code — see
    // packages/api/src/auth/require-auth.ts.
    const cognitoAuthorizer = new HttpJwtAuthorizer('CognitoAuthorizer', props.userPool.userPoolProviderUrl, {
      jwtAudience: [props.userPoolClient.userPoolClientId],
    });

    this.httpApi.addRoutes({
      path: '/auth-sync',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('AuthSyncIntegration', authSyncFn),
      authorizer: cognitoAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/auth-sync/me',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('AuthSyncMeIntegration', authSyncFn),
      authorizer: cognitoAuthorizer,
    });

    // Subscribe/unsubscribe are public (guest newsletter signup); preferences requires a signed-in user.
    this.httpApi.addRoutes({
      path: '/newsletter/subscribe',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('NewsletterSubscribeIntegration', newsletterFn),
    });
    this.httpApi.addRoutes({
      path: '/newsletter/unsubscribe',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('NewsletterUnsubscribeIntegration', newsletterFn),
    });
    this.httpApi.addRoutes({
      path: '/newsletter/preferences',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: new HttpLambdaIntegration('NewsletterPreferencesIntegration', newsletterFn),
      authorizer: cognitoAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/newsletter/admin/campaigns',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('NewsletterAdminCampaignsIntegration', newsletterFn),
      authorizer: cognitoAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/newsletter/admin/campaigns/{id}/send',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('NewsletterSendCampaignIntegration', newsletterFn),
      authorizer: cognitoAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/newsletter/admin/campaigns/{id}/logs',
      methods: [apigwv2.HttpMethod.GET],
      integration: new HttpLambdaIntegration('NewsletterCampaignLogsIntegration', newsletterFn),
      authorizer: cognitoAuthorizer,
    });

    // --- Catalog (Phase 3): public Pre-Sale browsing + admin event/design/packaging management.
    // The Cognito authorizer only proves the caller is signed in; `requireAdminRole` in application
    // code independently enforces the `admin` DB role — the authorizer is not the security boundary.
    const catalogIntegration = new HttpLambdaIntegration('CatalogIntegration', catalogFn);
    this.httpApi.addRoutes({
      path: '/catalog/presale/active',
      methods: [apigwv2.HttpMethod.GET],
      integration: catalogIntegration,
    });
    this.httpApi.addRoutes({
      path: '/catalog/admin/presale-events',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: catalogIntegration,
      authorizer: cognitoAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/catalog/admin/presale-events/{id}',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: catalogIntegration,
      authorizer: cognitoAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/catalog/admin/cookie-designs',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: catalogIntegration,
      authorizer: cognitoAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/catalog/admin/cookie-designs/{id}',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: catalogIntegration,
      authorizer: cognitoAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/catalog/admin/packaging-options',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: catalogIntegration,
      authorizer: cognitoAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/catalog/admin/packaging-options/{id}',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: catalogIntegration,
      authorizer: cognitoAuthorizer,
    });

    // --- Orders (Phase 4/6/7): guest-or-authenticated Pre-Sale checkout, authenticated order history,
    // and admin order management. `/orders/presale` must stay public at the gateway (guest checkout is
    // allowed); `optionalAuth` in application code still parses/validates a JWT when one is provided.
    const ordersIntegration = new HttpLambdaIntegration('OrdersIntegration', ordersFn);
    this.httpApi.addRoutes({
      path: '/orders/presale',
      methods: [apigwv2.HttpMethod.POST],
      integration: ordersIntegration,
    });
    this.httpApi.addRoutes({
      path: '/orders/me',
      methods: [apigwv2.HttpMethod.GET],
      integration: ordersIntegration,
      authorizer: cognitoAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/orders/me/{id}',
      methods: [apigwv2.HttpMethod.GET],
      integration: ordersIntegration,
      authorizer: cognitoAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/orders/admin',
      methods: [apigwv2.HttpMethod.GET],
      integration: ordersIntegration,
      authorizer: cognitoAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/orders/admin/{id}',
      methods: [apigwv2.HttpMethod.GET],
      integration: ordersIntegration,
      authorizer: cognitoAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/orders/admin/{id}/status',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: ordersIntegration,
      authorizer: cognitoAuthorizer,
    });

    // --- Stripe webhook (Phase 6): public (Stripe signs the request body; verified in application
    // code via the webhook signing secret), never behind the Cognito authorizer.
    this.httpApi.addRoutes({
      path: '/webhooks/stripe',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('WebhooksStripeIntegration', webhooksStripeFn),
    });

    new CfnOutput(this, 'HttpApiUrl', {
      description: 'Base URL for the deployed HTTP API',
      value: this.httpApi.apiEndpoint,
    });
    new CfnOutput(this, 'MigrateFunctionArn', {
      description: 'One-off database migration Lambda invoked by the deployment workflow',
      value: migrateFn.functionArn,
    });
    const httpApiServerErrorsAlarm = new cloudwatch.Alarm(this, 'HttpApiServerErrorsAlarm', {
      alarmDescription: 'Investigate repeated 5xx responses from the public API.',
      metric: this.httpApi.metricServerError({
        period: Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 5,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    httpApiServerErrorsAlarm.addAlarmAction(alarmAction);
  }
}
