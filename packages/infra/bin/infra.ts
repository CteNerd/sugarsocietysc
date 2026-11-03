import { App, Environment, Tags } from 'aws-cdk-lib';
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

Tags.of(app).add('Project', 'SugarSocietySC');
Tags.of(app).add('Environment', envConfig.envName);

const network = new NetworkStack(app, `${prefix}-Network`, envConfig, { env });
const data = new DataStack(app, `${prefix}-Data`, envConfig, { env, vpc: network.vpc });

// Keep exports consumed by the currently deployed VPC-based API stack during the staged runtime
// migration. Remove these only after the API stack has stopped importing them in a separate step.
network.exportValue(network.vpc.privateSubnets[0].subnetId, {
  name: `${network.stackName}:ExportsOutputRefVpcprivateegressSubnet1Subnet830BC88F45116193`,
});
network.exportValue(network.vpc.privateSubnets[1].subnetId, {
  name: `${network.stackName}:ExportsOutputRefVpcprivateegressSubnet2SubnetEB0EA9CBFD91A0CD`,
});
data.exportValue(data.lambdaSecurityGroup.securityGroupId, {
  name: `${data.stackName}:ExportsOutputFnGetAttLambdaSg30A6108CGroupId30BB2F0D`,
});

const auth = new AuthStack(app, `${prefix}-Auth`, envConfig, { env });
const web = new WebStack(app, `${prefix}-Web`, envConfig, { env });
new ApiStack(app, `${prefix}-Api`, envConfig, {
  env,
  cluster: data.cluster,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  uploadsBucket: web.bucket,
});
