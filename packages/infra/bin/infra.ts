import { App, Environment } from 'aws-cdk-lib';
import { ApiStack } from '../lib/api-stack';
import { AuthStack } from '../lib/auth-stack';
import { DataStack } from '../lib/data-stack';
import { getEnvConfig } from '../lib/env-config';
import { NetworkStack } from '../lib/network-stack';
import { WebStack } from '../lib/web-stack';

const app = new App();
const envConfig = getEnvConfig(app);
const env: Environment = { account: envConfig.account, region: envConfig.region };
const prefix = `SugarSocietySc-${envConfig.envName}`;

const network = new NetworkStack(app, `${prefix}-Network`, envConfig, { env });
const data = new DataStack(app, `${prefix}-Data`, envConfig, { env, vpc: network.vpc });
const auth = new AuthStack(app, `${prefix}-Auth`, envConfig, { env });
const web = new WebStack(app, `${prefix}-Web`, envConfig, { env });
new ApiStack(app, `${prefix}-Api`, envConfig, {
  env,
  vpc: network.vpc,
  lambdaSecurityGroup: data.lambdaSecurityGroup,
  cluster: data.cluster,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  uploadsBucket: web.bucket,
});
