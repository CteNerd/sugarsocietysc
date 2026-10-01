import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
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
 * fronting one NodejsFunction per domain. Health, auth-sync, and newsletter are wired up through
 * Phase 2 — later phases add catalog/orders/admin/webhook functions following this same pattern.
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
      COGNITO_ISSUER_URL: props.userPool.userPoolProviderUrl,
      COGNITO_CLIENT_ID: props.userPoolClient.userPoolClientId,
    };

    const healthFn = new lambdaNode.NodejsFunction(this, 'HealthFn', {
      entry: path.join(__dirname, '../../api/src/lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      environment: commonEnv,
    });
    props.cluster.secret?.grantRead(healthFn);

    const authSyncFn = new lambdaNode.NodejsFunction(this, 'AuthSyncFn', {
      entry: path.join(__dirname, '../../api/src/lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      environment: commonEnv,
    });
    props.cluster.secret?.grantRead(authSyncFn);

    const newsletterFn = new lambdaNode.NodejsFunction(this, 'NewsletterFn', {
      entry: path.join(__dirname, '../../api/src/lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      environment: commonEnv,
    });
    props.cluster.secret?.grantRead(newsletterFn);

    const catalogFn = new lambdaNode.NodejsFunction(this, 'CatalogFn', {
      entry: path.join(__dirname, '../../api/src/lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
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
      environment: stripeEnv,
    });
    props.cluster.secret?.grantRead(ordersFn);
    stripeSecret.grantRead(ordersFn);

    const webhooksStripeFn = new lambdaNode.NodejsFunction(this, 'WebhooksStripeFn', {
      entry: path.join(__dirname, '../../api/src/lambda.ts'),
      handler: 'handler',
      ...commonFnProps,
      environment: stripeEnv,
    });
    props.cluster.secret?.grantRead(webhooksStripeFn);
    stripeSecret.grantRead(webhooksStripeFn);

    this.httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: `sugarsocietysc-${envConfig.envName}`,
      corsPreflight: {
        allowOrigins: [`https://${envConfig.domainName}`],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.PATCH],
        allowHeaders: ['Authorization', 'Content-Type'],
      },
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
  }
}
