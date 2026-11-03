import { ArnFormat, CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
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
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import * as path from 'path';
import { EnvConfig } from './env-config';

export interface ApiStackProps extends StackProps {
  cluster: rds.DatabaseCluster;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  uploadsBucket: s3.IBucket;
}

/**
 * HTTP API (cheaper than REST API, native JWT authorizer support for Cognito)
 * fronting NodejsFunctions for the API domains and scheduled/queue-driven maintenance workers.
 */
export class ApiStack extends Stack {
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, envConfig: EnvConfig, props: ApiStackProps) {
    super(scope, id, props);
    const databaseSecret = props.cluster.secret;
    if (!databaseSecret) throw new Error('Data API requires a managed Aurora credentials secret');

    const commonFnProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.seconds(28),
    };
    const commonEnv = {
      DATABASE_DRIVER: 'data-api',
      DB_CLUSTER_ARN: props.cluster.clusterArn,
      DB_SECRET_ARN: databaseSecret.secretArn,
      // Retained during staged rollout so rollback to the current pg bootstrap keeps its exports.
      DB_HOST: props.cluster.clusterEndpoint.hostname,
      DB_PORT: props.cluster.clusterEndpoint.port.toString(),
      DB_NAME: 'sugarsocietysc',
      INVENTORY_EXPIRY_MODE: envConfig.inventoryExpiryMode,
      UPLOADS_BUCKET_NAME: props.uploadsBucket.bucketName,
      UPLOADS_PUBLIC_BASE_URL: `https://${envConfig.domainName}`,
      GUEST_PII_RETENTION_DAYS: envConfig.guestPiiRetentionDays.toString(),
      CONTACT_SUBMISSION_RETENTION_DAYS: '365',
      ADMIN_EMAILS: envConfig.adminEmails.join(','),
      ADMIN_EMAIL_DOMAIN: envConfig.adminEmailDomain,
      SMS_PROVIDER: 'sns',
      NEWSLETTER_FROM_EMAIL: process.env.NEWSLETTER_FROM_EMAIL || 'newsletter@sugarsocietysc.com',
      NEWSLETTER_SITE_URL: `https://${envConfig.domainName}`,
      NEWSLETTER_SIGNATURE: process.env.NEWSLETTER_SIGNATURE || 'Sugar Society Sugar Cookies',
      COGNITO_ISSUER_URL: props.userPool.userPoolProviderUrl,
      COGNITO_CLIENT_ID: props.userPoolClient.userPoolClientId,
    };
    const grantDatabaseAccess = (fn: lambda.IFunction) => {
      props.cluster.grantDataApiAccess(fn);
      databaseSecret.grantRead(fn);
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
    grantDatabaseAccess(healthFn);

    // Not wired to HTTP or a trigger. Invoke after deployment to apply the bundled migrations
    // through Data API before enabling scheduled expiration.
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
    grantDatabaseAccess(migrateFn);

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
    grantDatabaseAccess(seedFn);

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
    const contactDeadLetterQueue = new sqs.Queue(this, 'ContactDeadLetterQueue', {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(14),
    });
    const contactQueue = new sqs.Queue(this, 'ContactQueue', {
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(4),
      visibilityTimeout: Duration.seconds(360),
      deadLetterQueue: {
        queue: contactDeadLetterQueue,
        maxReceiveCount: 5,
      },
    });
    const inventoryExpiryDeadLetterQueue = envConfig.inventoryExpiryMode === 'scheduled'
      ? new sqs.Queue(this, 'InventoryExpiryDeadLetterQueue', {
        encryption: sqs.QueueEncryption.SQS_MANAGED,
        retentionPeriod: Duration.days(14),
      })
      : undefined;

    const guestPiiRetentionFn = new lambdaNode.NodejsFunction(this, 'GuestPiiRetentionFn', {
      entry: path.join(__dirname, '../../api/src/guest-pii-retention-lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      logGroup: functionLogGroup('GuestPiiRetentionFn'),
      timeout: Duration.seconds(60),
      environment: commonEnv,
    });
    grantDatabaseAccess(guestPiiRetentionFn);
    new events.Rule(this, 'GuestPiiRetentionSchedule', {
      description: `Purge terminal-order guest contact details after ${envConfig.guestPiiRetentionDays} days and contact submissions after 365 days`,
      schedule: events.Schedule.cron({ minute: '0', hour: '3' }),
      targets: [new targets.LambdaFunction(guestPiiRetentionFn)],
    });
    const inventoryHoldExpiryFn = new lambdaNode.NodejsFunction(this, 'InventoryHoldExpiryFn', {
      entry: path.join(__dirname, '../../api/src/inventory-hold-expiry-lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      logGroup: functionLogGroup('InventoryHoldExpiryFn'),
      timeout: Duration.seconds(60),
      ...(inventoryExpiryDeadLetterQueue
        ? {
          deadLetterQueue: inventoryExpiryDeadLetterQueue,
          maxEventAge: Duration.hours(1),
          retryAttempts: 2,
        }
        : {}),
      environment: commonEnv,
    });
    grantDatabaseAccess(inventoryHoldExpiryFn);

    const inventoryExpiryScheduleGroupName = `sugarsocietysc-${envConfig.envName}-inventory-expiry`;
    const inventoryExpiryScheduleGroup = envConfig.inventoryExpiryMode === 'scheduled'
      ? new scheduler.CfnScheduleGroup(this, 'InventoryExpiryScheduleGroup', {
        name: inventoryExpiryScheduleGroupName,
      })
      : undefined;
    const inventoryExpiryScheduleRole = inventoryExpiryScheduleGroup
      ? new iam.Role(this, 'InventoryExpiryScheduleRole', {
        assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com').withConditions({
          StringEquals: { 'aws:SourceAccount': Stack.of(this).account },
          ArnLike: { 'aws:SourceArn': inventoryExpiryScheduleGroup.attrArn },
        }),
        description: 'Allows the inventory-expiry schedule group to invoke only the expiry Lambda.',
      })
      : undefined;
    if (inventoryExpiryScheduleRole) {
      inventoryExpiryScheduleRole.addToPolicy(new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [inventoryHoldExpiryFn.functionArn],
      }));
      if (inventoryExpiryDeadLetterQueue) inventoryExpiryScheduleRole.addToPolicy(new iam.PolicyStatement({
        actions: ['sqs:SendMessage'],
        resources: [inventoryExpiryDeadLetterQueue.queueArn],
      }));
    }

    const inventoryExpiryScheduleEnvironment: Record<string, string> =
      inventoryExpiryScheduleGroup && inventoryExpiryScheduleRole && inventoryExpiryDeadLetterQueue
      ? {
        INVENTORY_EXPIRY_SCHEDULE_GROUP: inventoryExpiryScheduleGroupName,
        INVENTORY_EXPIRY_TARGET_ARN: inventoryHoldExpiryFn.functionArn,
        INVENTORY_EXPIRY_ROLE_ARN: inventoryExpiryScheduleRole.roleArn,
        INVENTORY_EXPIRY_DLQ_ARN: inventoryExpiryDeadLetterQueue.queueArn,
      }
      : {};
    const inventoryExpiryScheduleArn = this.formatArn({
      service: 'scheduler',
      resource: 'schedule',
      resourceName: `${inventoryExpiryScheduleGroupName}/order-*`,
      arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
    });
    const grantInventoryExpiryScheduleManagement = (fn: lambda.IFunction) => {
      if (!inventoryExpiryScheduleRole) return;
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['scheduler:CreateSchedule', 'scheduler:GetSchedule'],
        resources: [inventoryExpiryScheduleArn],
      }));
      fn.addToRolePolicy(new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [inventoryExpiryScheduleRole.roleArn],
        conditions: {
          StringEquals: { 'iam:PassedToService': 'scheduler.amazonaws.com' },
        },
      }));
    };

    if (envConfig.inventoryExpiryMode === 'polling') {
      new events.Rule(this, 'InventoryHoldExpirySchedule', {
        description: 'Release cookie inventory held by unpaid checkouts after 30 minutes',
        schedule: events.Schedule.rate(Duration.minutes(5)),
        targets: [new targets.LambdaFunction(inventoryHoldExpiryFn)],
      });
    }
    const inventoryHoldExpiryErrorsAlarm = new cloudwatch.Alarm(this, 'InventoryHoldExpiryErrorsAlarm', {
      alarmDescription: 'Investigate failures in the scheduled unpaid inventory hold expiry job.',
      metric: inventoryHoldExpiryFn.metricErrors({ period: Duration.minutes(5), statistic: 'Sum' }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    inventoryHoldExpiryErrorsAlarm.addAlarmAction(alarmAction);
    if (inventoryExpiryDeadLetterQueue) {
      const inventoryExpiryDeadLetterQueueAlarm = new cloudwatch.Alarm(
        this,
        'InventoryExpiryDeadLetterQueueAlarm',
        {
          alarmDescription: 'Investigate scheduled inventory-expiry invocations that exhausted retries.',
          metric: inventoryExpiryDeadLetterQueue.metricApproximateNumberOfMessagesVisible({
            period: Duration.minutes(5),
            statistic: 'Maximum',
          }),
          threshold: 1,
          evaluationPeriods: 1,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        },
      );
      inventoryExpiryDeadLetterQueueAlarm.addAlarmAction(alarmAction);
    }
    const guestPiiRetentionErrorsAlarm = new cloudwatch.Alarm(this, 'GuestPiiRetentionErrorsAlarm', {
      alarmDescription: 'Investigate failures in scheduled guest-order and contact-submission retention.',
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
    grantDatabaseAccess(authSyncFn);

    const newsletterFn = new lambdaNode.NodejsFunction(this, 'NewsletterFn', {
      entry: path.join(__dirname, '../../api/src/lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      logGroup: functionLogGroup('NewsletterFn'),
      environment: { ...commonEnv, NEWSLETTER_QUEUE_URL: newsletterQueue.queueUrl },
    });
    grantDatabaseAccess(newsletterFn);
    newsletterQueue.grantSendMessages(newsletterFn);

    const googleRecaptchaSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'GoogleRecaptchaSecret',
      `sugarsocietysc/${envConfig.envName}/google-recaptcha`,
    );
    const contactFn = new lambdaNode.NodejsFunction(this, 'ContactFn', {
      entry: path.join(__dirname, '../../api/src/lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      timeout: Duration.seconds(20),
      logGroup: functionLogGroup('ContactFn'),
      environment: {
        ...commonEnv,
        CONTACT_QUEUE_URL: contactQueue.queueUrl,
        GOOGLE_RECAPTCHA_SECRET_ARN: googleRecaptchaSecret.secretArn,
      },
    });
    grantDatabaseAccess(contactFn);
    googleRecaptchaSecret.grantRead(contactFn);
    contactQueue.grantSendMessages(contactFn);

    const contactWorkerFn = new lambdaNode.NodejsFunction(this, 'ContactWorkerFn', {
      entry: path.join(__dirname, '../../api/src/domains/contact/contact-worker.ts'),
      handler: 'handler',
      ...commonFnProps,
      logGroup: functionLogGroup('ContactWorkerFn'),
      timeout: Duration.seconds(60),
      environment: { ...commonEnv, CONTACT_QUEUE_URL: contactQueue.queueUrl },
    });
    grantDatabaseAccess(contactWorkerFn);
    contactQueue.grantConsumeMessages(contactWorkerFn);
    contactWorkerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail'],
      resources: [
        this.formatArn({
          service: 'ses',
          resource: 'identity',
          resourceName: commonEnv.NEWSLETTER_FROM_EMAIL,
          arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
        }),
      ],
    }));
    contactWorkerFn.addEventSource(new eventSources.SqsEventSource(contactQueue, {
      batchSize: 10,
      reportBatchItemFailures: true,
    }));
    const contactDeadLetterQueueAlarm = new cloudwatch.Alarm(this, 'ContactDeadLetterQueueAlarm', {
      alarmDescription: 'Investigate and redrive contact notification emails that exhausted SQS retries.',
      metric: contactDeadLetterQueue.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(5),
        statistic: 'Maximum',
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    contactDeadLetterQueueAlarm.addAlarmAction(alarmAction);
    const contactWorkerErrorsAlarm = new cloudwatch.Alarm(this, 'ContactWorkerErrorsAlarm', {
      alarmDescription: 'Investigate contact notification worker delivery failures.',
      metric: contactWorkerFn.metricErrors({ period: Duration.minutes(5), statistic: 'Sum' }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    contactWorkerErrorsAlarm.addAlarmAction(alarmAction);

    const newsletterWorkerFn = new lambdaNode.NodejsFunction(this, 'NewsletterWorkerFn', {
      entry: path.join(__dirname, '../../api/src/domains/newsletter/newsletter-worker.ts'),
      handler: 'handler',
      ...commonFnProps,
      logGroup: functionLogGroup('NewsletterWorkerFn'),
      timeout: Duration.seconds(60),
      environment: { ...commonEnv, NEWSLETTER_QUEUE_URL: newsletterQueue.queueUrl },
    });
    grantDatabaseAccess(newsletterWorkerFn);
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
    grantDatabaseAccess(catalogFn);
    props.uploadsBucket.grantPut(catalogFn, 'uploads/menu-items/*');

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
      environment: { ...stripeEnv, ...inventoryExpiryScheduleEnvironment },
    });
    grantDatabaseAccess(ordersFn);
    stripeSecret.grantRead(ordersFn);
    grantInventoryExpiryScheduleManagement(ordersFn);

    if (envConfig.inventoryExpiryMode === 'scheduled' && inventoryExpiryDeadLetterQueue) {
      const inventoryExpiryDispatcherFn = new lambdaNode.NodejsFunction(
        this,
        'InventoryExpiryDispatcherFn',
        {
          entry: path.join(__dirname, '../../api/src/inventory-expiry-dispatch-lambda.ts'),
          handler: 'handler',
          ...commonFnProps,
          logGroup: functionLogGroup('InventoryExpiryDispatcherFn'),
          timeout: Duration.seconds(60),
          deadLetterQueue: inventoryExpiryDeadLetterQueue,
          maxEventAge: Duration.hours(1),
          retryAttempts: 2,
          environment: { ...commonEnv, ...inventoryExpiryScheduleEnvironment },
        },
      );
      grantDatabaseAccess(inventoryExpiryDispatcherFn);
      grantInventoryExpiryScheduleManagement(inventoryExpiryDispatcherFn);
      new events.Rule(this, 'InventoryExpiryReconciliationSchedule', {
        description: 'Schedule pending inventory expirations and reconcile overdue order holds.',
        schedule: events.Schedule.rate(Duration.hours(1)),
        targets: [
          new targets.LambdaFunction(inventoryExpiryDispatcherFn, {
            deadLetterQueue: inventoryExpiryDeadLetterQueue,
            maxEventAge: Duration.hours(1),
            retryAttempts: 2,
          }),
        ],
      });
    }

    const webhooksStripeFn = new lambdaNode.NodejsFunction(this, 'WebhooksStripeFn', {
      entry: path.join(__dirname, '../../api/src/lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      logGroup: functionLogGroup('WebhooksStripeFn'),
      environment: stripeEnv,
    });
    grantDatabaseAccess(webhooksStripeFn);
    stripeSecret.grantRead(webhooksStripeFn);

    this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: `sugarsocietysc-${envConfig.envName}`,
      corsPreflight: {
        allowOrigins: [`https://${envConfig.domainName}`],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.PUT,
        ],
        allowHeaders: ['Authorization', 'Content-Type'],
      },
    });
    // Account-level API Gateway throttling is a shared default across the whole AWS account — an
    // explicit per-stage limit here caps abuse/runaway-automation traffic to this API specifically,
    // ahead of exposing it to more automated/MCP-style callers.
    // Throttling is set on the HttpApi's built-in default stage (not a separate HttpStage) so the
    // stage keeps its original logical ID; a new logical ID makes CloudFormation create a second
    // `$default` stage before deleting the old one, which fails with "already exists".
    const defaultStage = this.httpApi.defaultStage?.node.defaultChild as apigwv2.CfnStage;
    // Prod was first deployed with the standalone HttpStage, unlike dev. Preserve its deployed
    // logical ID so moving to the built-in stage updates it rather than creating a duplicate.
    if (envConfig.envName === 'prod') {
      defaultStage.overrideLogicalId('HttpApiDefaultStage439BF176');
    }
    defaultStage.defaultRouteSettings = { throttlingRateLimit: 50, throttlingBurstLimit: 100 };

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
      path: '/contact',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('ContactIntegration', contactFn),
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
      path: '/catalog/presale/events',
      methods: [apigwv2.HttpMethod.GET],
      integration: catalogIntegration,
    });
    this.httpApi.addRoutes({
      path: '/catalog/presale/events/{id}',
      methods: [apigwv2.HttpMethod.GET],
      integration: catalogIntegration,
    });
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
      path: '/catalog/admin/menu-categories',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: catalogIntegration,
      authorizer: cognitoAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/catalog/admin/menu-item-images/upload-url',
      methods: [apigwv2.HttpMethod.POST],
      integration: catalogIntegration,
      authorizer: cognitoAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/catalog/admin/menu-categories/{id}',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: catalogIntegration,
      authorizer: cognitoAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/catalog/admin/menu-variants',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: catalogIntegration,
      authorizer: cognitoAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/catalog/admin/menu-variants/{id}',
      methods: [apigwv2.HttpMethod.PATCH],
      integration: catalogIntegration,
      authorizer: cognitoAuthorizer,
    });
    this.httpApi.addRoutes({
      path: '/catalog/admin/presale-events/{id}/packaging',
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.PUT],
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
