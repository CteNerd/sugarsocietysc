import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as rds from 'aws-cdk-lib/aws-rds';
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
 * fronting one NodejsFunction per domain. Health and auth-sync are wired up through Phase 1 —
 * later phases add newsletter/catalog/orders/admin/webhook functions following this same pattern.
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
  }
}
