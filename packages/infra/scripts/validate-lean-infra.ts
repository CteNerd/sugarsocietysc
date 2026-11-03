import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { App, Environment, Tags } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { ApiStack } from '../lib/api-stack';
import { AuthStack } from '../lib/auth-stack';
import { DataStack } from '../lib/data-stack';
import { EnvConfig, getEnvConfig } from '../lib/env-config';
import { NetworkStack } from '../lib/network-stack';
import { WebStack } from '../lib/web-stack';

interface PolicyStatement {
  Action: string | string[];
  Resource: unknown;
  Condition?: unknown;
}
interface PolicyDocument { Statement: PolicyStatement[] }
interface RuleTarget {
  RetryPolicy?: { MaximumEventAgeInSeconds: number; MaximumRetryAttempts: number };
  DeadLetterConfig?: { Arn: unknown };
}
interface ResourceProperties {
  'AWS::Lambda::Function': {
    Role?: { 'Fn::GetAtt': string[] };
    Environment: { Variables: Record<string, unknown> };
    Tags: Array<{ Key: string; Value: string }>;
    VpcConfig?: unknown;
    DeadLetterConfig?: { TargetArn: unknown };
  };
  'AWS::IAM::Role': {
    AssumeRolePolicyDocument: unknown;
    Policies?: Array<{ PolicyDocument: PolicyDocument }>;
  };
  'AWS::IAM::Policy': {
    Roles?: Array<{ Ref: string }>;
    PolicyDocument: PolicyDocument;
  };
  'AWS::RDS::DBCluster': {
    EnableHttpEndpoint: boolean;
    ServerlessV2ScalingConfiguration: { MinCapacity: number; SecondsUntilAutoPause?: number };
  };
  'AWS::Events::Rule': { ScheduleExpression?: string; Targets?: RuleTarget[] };
  'AWS::Lambda::EventInvokeConfig': {
    FunctionName: unknown;
    MaximumEventAgeInSeconds: number;
    MaximumRetryAttempts: number;
  };
  'AWS::CloudWatch::Alarm': { AlarmDescription?: string };
  'AWS::Scheduler::ScheduleGroup': unknown;
  'AWS::EC2::SecurityGroup': { GroupDescription: string };
  'AWS::EC2::NatGateway': unknown;
  'AWS::EC2::Subnet': unknown;
  'AWS::SQS::Queue': unknown;
}
interface CfnResource<Properties = unknown> {
  Type: string;
  Properties: Properties;
  DeletionPolicy?: string;
  UpdateReplacePolicy?: string;
}
interface CfnTemplate {
  Resources: Record<string, CfnResource>;
  Outputs?: Record<string, { Export?: { Name: unknown } }>;
}
type InfrastructureTemplates = { network: CfnTemplate; data: CfnTemplate; api: CfnTemplate };

function cfnTemplate(template: Template): CfnTemplate {
  const json = template.toJSON();
  assert.ok(json.Resources && typeof json.Resources === 'object' && !Array.isArray(json.Resources));
  return { Resources: json.Resources, Outputs: json.Outputs };
}

const cdkContext = JSON.parse(readFileSync(path.join(__dirname, '../cdk.json'), 'utf8'))
  .context.environments as Record<string, Record<string, unknown>>;

function readConfig(
  envName: 'dev' | 'prod',
  overrides: Record<string, unknown> = {},
  omitDefaults = false,
) {
  const environment = { ...cdkContext[envName], ...overrides };
  if (omitDefaults) {
    delete environment.inventoryExpiryMode;
    delete environment.auroraAutoPauseSeconds;
    delete environment.auroraMinCapacity;
  }
  const app = new App({
    context: { env: envName, environments: { [envName]: environment } },
  });
  return { app, config: getEnvConfig(app) };
}

function buildInfrastructure(config: EnvConfig): InfrastructureTemplates {
  const app = new App();
  Tags.of(app).add('Project', 'SugarSocietySC');
  Tags.of(app).add('Environment', config.envName);
  const env: Environment = { account: config.account, region: config.region };
  const prefix = `SugarSocietySc-${config.envName}`;
  const network = new NetworkStack(app, `${prefix}-Network`, config, { env });
  const data = new DataStack(app, `${prefix}-Data`, config, { env, vpc: network.vpc });
  network.exportValue(network.vpc.privateSubnets[0].subnetId, {
    name: `${network.stackName}:ExportsOutputRefVpcprivateegressSubnet1Subnet830BC88F45116193`,
  });
  network.exportValue(network.vpc.privateSubnets[1].subnetId, {
    name: `${network.stackName}:ExportsOutputRefVpcprivateegressSubnet2SubnetEB0EA9CBFD91A0CD`,
  });
  data.exportValue(data.lambdaSecurityGroup.securityGroupId, {
    name: `${data.stackName}:ExportsOutputFnGetAttLambdaSg30A6108CGroupId30BB2F0D`,
  });

  const auth = new AuthStack(app, `${prefix}-Auth`, config, { env });
  const web = new WebStack(app, `${prefix}-Web`, config, { env });
  const api = new ApiStack(app, `${prefix}-Api`, config, {
    env,
    cluster: data.cluster,
    userPool: auth.userPool,
    userPoolClient: auth.userPoolClient,
    uploadsBucket: web.bucket,
  });

  return {
    network: cfnTemplate(Template.fromStack(network)),
    data: cfnTemplate(Template.fromStack(data)),
    api: cfnTemplate(Template.fromStack(api)),
  };
}

function buildProdData(config: EnvConfig): Pick<InfrastructureTemplates, 'network' | 'data'> {
  const app = new App();
  Tags.of(app).add('Project', 'SugarSocietySC');
  Tags.of(app).add('Environment', config.envName);
  const env: Environment = { account: config.account, region: config.region };
  const network = new NetworkStack(app, 'SugarSocietySc-prod-Network', config, { env });
  const data = new DataStack(app, 'SugarSocietySc-prod-Data', config, { env, vpc: network.vpc });
  return {
    network: cfnTemplate(Template.fromStack(network)),
    data: cfnTemplate(Template.fromStack(data)),
  };
}

function resources<Type extends keyof ResourceProperties>(
  template: CfnTemplate, type: Type,
): Array<[string, CfnResource<ResourceProperties[Type]>]> {
  // CDK owns the template shape; filtering its resource type narrows the corresponding properties.
  return Object.entries(template.Resources).filter(([, resource]) => resource.Type === type) as
    Array<[string, CfnResource<ResourceProperties[Type]>]>;
}

function policyStatements(template: CfnTemplate): PolicyStatement[] {
  const statements: PolicyStatement[] = [];
  for (const [, resource] of resources(template, 'AWS::IAM::Role')) {
    for (const policy of resource.Properties?.Policies ?? []) {
      statements.push(...(policy.PolicyDocument.Statement ?? []));
    }
  }
  for (const [, resource] of resources(template, 'AWS::IAM::Policy')) {
    statements.push(...(resource.Properties?.PolicyDocument.Statement ?? []));
  }
  return statements;
}

function assertScopedDataApiGrants(template: CfnTemplate, expectedFunctions: number) {
  const functions = resources(template, 'AWS::Lambda::Function');
  const policies = resources(template, 'AWS::IAM::Policy');
  const expectedActions = [
    'rds-data:BatchExecuteStatement',
    'rds-data:BeginTransaction',
    'rds-data:CommitTransaction',
    'rds-data:ExecuteStatement',
    'rds-data:RollbackTransaction',
  ];
  assert.equal(functions.length, expectedFunctions);
  for (const [functionId, fn] of functions) {
    const roleId = fn.Properties.Role?.['Fn::GetAtt']?.[0]?.split('.')[0];
    assert.ok(roleId, `${functionId} should have a dedicated execution role`);
    const rolePolicies = policies
      .filter(([, policy]) => policy.Properties.Roles?.some((role) => role.Ref === roleId))
      .flatMap(([, policy]) => policy.Properties.PolicyDocument.Statement ?? []);
    const dataApiGrant = rolePolicies.find((statement) =>
      JSON.stringify(statement.Action).includes('rds-data:ExecuteStatement'));
    assert.ok(dataApiGrant, `${functionId} should have Data API access`);
    assert.deepEqual([...dataApiGrant.Action].sort(), [...expectedActions].sort());
    const resource = JSON.stringify(dataApiGrant.Resource);
    assert.ok(resource.includes('Fn::ImportValue'));
    assert.ok(resource.includes('AuroraPostgres'));
    assert.ok(!resource.includes('"*"'), `${functionId} Data API access must be cluster-scoped`);
  }
}

function assertHasExport(template: CfnTemplate, exportName: string) {
  assert.ok(
    Object.values(template.Outputs ?? {}).some((output) => output.Export?.Name === exportName),
    `expected preserved CloudFormation export ${exportName}`,
  );
}

function checkConfigurationValidation() {
  const defaultConfig = readConfig('dev', {}, true).config;
  assert.equal(defaultConfig.inventoryExpiryMode, 'polling');
  assert.equal(defaultConfig.auroraAutoPauseSeconds, 300);
  assert.equal(defaultConfig.auroraMinCapacity, 0.5);
  assert.equal(readConfig('dev', { auroraAutoPauseSeconds: 300 }).config.auroraAutoPauseSeconds, 300);
  assert.equal(
    readConfig('dev', { auroraAutoPauseSeconds: 86_400 }).config.auroraAutoPauseSeconds,
    86_400,
  );
  assert.equal(readConfig('dev', { natGateways: 0 }).config.natGateways, 0);
  assert.equal(
    readConfig('dev', { inventoryExpiryMode: 'scheduled', auroraMinCapacity: 0 }).config.auroraMinCapacity,
    0,
  );
  assert.throws(
    () => readConfig('dev', { auroraMinCapacity: 0 }),
    /only in scheduled mode/,
  );
  for (const seconds of [299, 86_401, 300.5]) {
    assert.throws(
      () => readConfig('dev', { auroraAutoPauseSeconds: seconds }),
      /between 300 and 86400/,
    );
  }
  assert.throws(
    () => readConfig('dev', { inventoryExpiryMode: 'unknown' }),
    /inventoryExpiryMode must be/,
  );
}

function checkPollingTemplate(templates: ReturnType<typeof buildInfrastructure>) {
  const lambdas = resources(templates.api, 'AWS::Lambda::Function');
  assert.equal(lambdas.length, 13, 'polling mode keeps the existing 13 functions');
  for (const [logicalId, resource] of lambdas) {
    assert.equal(resource.Properties.VpcConfig, undefined, `${logicalId} must not be in a VPC`);
    assert.equal(
      resource.Properties.Environment.Variables.DATABASE_DRIVER,
      'data-api',
      `${logicalId} must use the Data API runtime`,
    );
    assert.ok(resource.Properties.Tags.some(
      (tag) => tag.Key === 'Project' && tag.Value === 'SugarSocietySC',
    ));
    assert.ok(resource.Properties.Tags.some(
      (tag) => tag.Key === 'Environment' && tag.Value === 'dev',
    ));
  }
  assertScopedDataApiGrants(templates.api, 13);
  const apiJson = JSON.stringify(templates.api);
  assert.ok(apiJson.includes('DB_CLUSTER_ARN'));
  assert.ok(apiJson.includes('DB_SECRET_ARN'));
  assert.ok(apiJson.includes('rds-data:ExecuteStatement'));
  assert.ok(!apiJson.includes('"rds-data:ExecuteStatement","Resource":"*"'));
  assert.equal(resources(templates.api, 'AWS::Scheduler::ScheduleGroup').length, 0);
  const expiryRules = resources(templates.api, 'AWS::Events::Rule')
    .map(([, resource]) => resource.Properties)
    .filter((properties) => properties.ScheduleExpression === 'rate(5 minutes)');
  assert.equal(expiryRules.length, 1, 'polling mode retains the five-minute expiry rule');
  assert.equal(resources(templates.api, 'AWS::EC2::NatGateway').length, 0);
  assert.ok(JSON.stringify(templates.network).includes('AWS::EC2::NatGateway'));
}

function checkDataAndCompatibilityExports(templates: ReturnType<typeof buildInfrastructure>) {
  const cluster = resources(templates.data, 'AWS::RDS::DBCluster')
    .find(([logicalId]) => logicalId === 'AuroraPostgresAE2C8B71')?.[1];
  assert.ok(cluster, 'the deployed Aurora logical ID must remain unchanged');
  assert.equal(cluster.Properties.EnableHttpEndpoint, true);
  assert.equal(cluster.Properties.ServerlessV2ScalingConfiguration.MinCapacity, 0.5);
  assert.ok(JSON.stringify(templates.data).includes('isolateddataSubnet'));
  assert.ok(resources(templates.data, 'AWS::EC2::SecurityGroup')
    .some(([logicalId]) => logicalId === 'LambdaSg30A6108C'));
  const legacyLambdaSecurityGroup = resources(templates.data, 'AWS::EC2::SecurityGroup')
    .find(([logicalId]) => logicalId === 'LambdaSg30A6108C')?.[1];
  assert.ok(legacyLambdaSecurityGroup);
  assert.equal(legacyLambdaSecurityGroup.Properties.GroupDescription, 'Security group for API Lambdas that need DB access');
  assert.ok(resources(templates.data, 'AWS::EC2::SecurityGroup')
    .some(([logicalId]) => logicalId === 'DbSg495F8305'));

  const prefix = 'SugarSocietySc-dev';
  assertHasExport(
    templates.network,
    `${prefix}-Network:ExportsOutputRefVpcprivateegressSubnet1Subnet830BC88F45116193`,
  );
  assertHasExport(
    templates.network,
    `${prefix}-Network:ExportsOutputRefVpcprivateegressSubnet2SubnetEB0EA9CBFD91A0CD`,
  );
  assertHasExport(
    templates.data,
    `${prefix}-Data:ExportsOutputFnGetAttLambdaSg30A6108CGroupId30BB2F0D`,
  );
  assertHasExport(
    templates.data,
    `${prefix}-Data:ExportsOutputFnGetAttAuroraPostgresAE2C8B71EndpointAddressC45AB529`,
  );
  assertHasExport(
    templates.data,
    `${prefix}-Data:ExportsOutputFnGetAttAuroraPostgresAE2C8B71EndpointPortBC1A2987`,
  );
  assert.equal(resources(templates.network, 'AWS::EC2::NatGateway').length, 1);
}

function checkScheduledTemplate(templates: ReturnType<typeof buildInfrastructure>) {
  const lambdas = resources(templates.api, 'AWS::Lambda::Function');
  assert.equal(lambdas.length, 14, 'scheduled mode adds only the dispatcher Lambda');
  for (const [logicalId, resource] of lambdas) {
    assert.equal(resource.Properties.VpcConfig, undefined, `${logicalId} must not be in a VPC`);
    assert.equal(resource.Properties.Environment.Variables.DATABASE_DRIVER, 'data-api');
    assert.ok(resource.Properties.Tags.some(
      (tag) => tag.Key === 'Project' && tag.Value === 'SugarSocietySC',
    ));
    assert.ok(resource.Properties.Tags.some(
      (tag) => tag.Key === 'Environment' && tag.Value === 'dev',
    ));
  }
  assertScopedDataApiGrants(templates.api, 14);

  const cluster = resources(templates.data, 'AWS::RDS::DBCluster')[0][1];
  assert.equal(cluster.Properties.ServerlessV2ScalingConfiguration.MinCapacity, 0);
  assert.equal(cluster.Properties.ServerlessV2ScalingConfiguration.SecondsUntilAutoPause, 300);

  const scheduleGroup = resources(templates.api, 'AWS::Scheduler::ScheduleGroup');
  assert.equal(scheduleGroup.length, 1);
  const schedulerRoles = resources(templates.api, 'AWS::IAM::Role')
    .filter(([, role]) => JSON.stringify(role.Properties.AssumeRolePolicyDocument)
      .includes('scheduler.amazonaws.com'));
  assert.equal(schedulerRoles.length, 1);
  const [schedulerRoleId, schedulerRole] = schedulerRoles[0];
  const roleTrust = JSON.stringify(schedulerRole.Properties.AssumeRolePolicyDocument);
  assert.ok(roleTrust.includes('aws:SourceAccount'));
  assert.ok(roleTrust.includes('aws:SourceArn'));
  assert.ok(roleTrust.includes(scheduleGroup[0][0]));
  const roleStatements = [
    ...(schedulerRole.Properties.Policies ?? [])
      .flatMap((policy) => policy.PolicyDocument.Statement ?? []),
    ...resources(templates.api, 'AWS::IAM::Policy')
      .filter(([, policy]) => policy.Properties.Roles?.some(
        (role) => role.Ref === schedulerRoleId,
      ))
      .flatMap(([, policy]) => policy.Properties.PolicyDocument.Statement ?? []),
  ];
  assert.equal(roleStatements.length, 2, 'scheduler execution role invokes expiry and writes only its failure queue');
  assert.ok(JSON.stringify(roleStatements[0].Action).includes('lambda:InvokeFunction'));
  assert.ok(JSON.stringify(roleStatements[0].Resource).includes('InventoryHoldExpiryFn'));
  assert.equal((JSON.stringify(roleStatements[0].Resource).match(/\*/g) ?? []).length, 0);
  assert.deepEqual(roleStatements[1].Action, 'sqs:SendMessage');
  assert.ok(JSON.stringify(roleStatements[1].Resource).includes('InventoryExpiryDeadLetterQueue'));
  assert.equal((JSON.stringify(roleStatements[1].Resource).match(/\*/g) ?? []).length, 0);

  const ordersFunction = lambdas.find(([logicalId]) => logicalId.includes('OrdersFn'))?.[1];
  const dispatcherFunction = lambdas.find(([logicalId]) =>
    logicalId.includes('InventoryExpiryDispatcherFn'))?.[1];
  assert.ok(ordersFunction);
  assert.ok(dispatcherFunction);
  assert.ok(dispatcherFunction.Properties.DeadLetterConfig?.TargetArn);
  for (const fn of [ordersFunction, dispatcherFunction]) {
    const variables = fn.Properties.Environment.Variables;
    assert.equal(variables.INVENTORY_EXPIRY_SCHEDULE_GROUP, 'sugarsocietysc-dev-inventory-expiry');
    assert.ok(JSON.stringify(variables.INVENTORY_EXPIRY_TARGET_ARN).includes('InventoryHoldExpiryFn'));
    assert.ok(JSON.stringify(variables.INVENTORY_EXPIRY_ROLE_ARN).includes('InventoryExpiryScheduleRole'));
    assert.ok(JSON.stringify(variables.INVENTORY_EXPIRY_DLQ_ARN).includes('InventoryExpiryDeadLetterQueue'));
  }
  assert.ok(ordersFunction.Properties.Environment.Variables.STRIPE_SECRET_ARN);

  const policies = policyStatements(templates.api);
  const schedulePolicy = policies.find((statement) =>
    JSON.stringify(statement.Action).includes('scheduler:CreateSchedule'));
  assert.ok(schedulePolicy);
  assert.deepEqual(schedulePolicy.Action, ['scheduler:CreateSchedule', 'scheduler:GetSchedule']);
  const scheduleResource = JSON.stringify(schedulePolicy.Resource);
  assert.ok(scheduleResource.includes('schedule/sugarsocietysc-dev-inventory-expiry/order-*'));
  assert.equal((scheduleResource.match(/\*/g) ?? []).length, 1);
  const passRolePolicy = policies.find((statement) =>
    JSON.stringify(statement.Action).includes('iam:PassRole'));
  assert.ok(passRolePolicy);
  assert.deepEqual(passRolePolicy.Condition, {
    StringEquals: { 'iam:PassedToService': 'scheduler.amazonaws.com' },
  });

  const rules = resources(templates.api, 'AWS::Events::Rule')
    .map(([, resource]) => resource.Properties);
  assert.ok(rules.some((rule) => rule.ScheduleExpression === 'rate(1 hour)'));
  assert.ok(!rules.some((rule) => rule.ScheduleExpression === 'rate(5 minutes)'));
  const scheduledRetries = rules.flatMap((rule) => rule.Targets ?? [])
    .find((target) => target.RetryPolicy);
  assert.ok(scheduledRetries);
  assert.deepEqual(scheduledRetries.RetryPolicy, {
    MaximumEventAgeInSeconds: 3600,
    MaximumRetryAttempts: 2,
  });
  assert.ok(scheduledRetries.DeadLetterConfig?.Arn);

  const expiryFn = lambdas.find(([logicalId]) => logicalId.includes('InventoryHoldExpiryFn'))?.[1];
  assert.ok(expiryFn);
  assert.ok(expiryFn.Properties.DeadLetterConfig?.TargetArn);
  const expiryAsyncConfig = resources(templates.api, 'AWS::Lambda::EventInvokeConfig')
    .find(([, resource]) => JSON.stringify(resource.Properties.FunctionName)
      .includes('InventoryHoldExpiryFn'))?.[1];
  assert.ok(expiryAsyncConfig);
  assert.equal(expiryAsyncConfig.Properties.MaximumEventAgeInSeconds, 3600);
  assert.equal(expiryAsyncConfig.Properties.MaximumRetryAttempts, 2);
  assert.ok(resources(templates.api, 'AWS::SQS::Queue').length >= 3);
  assert.ok(resources(templates.api, 'AWS::CloudWatch::Alarm')
    .some(([, resource]) => resource.Properties.AlarmDescription
      ?.includes('scheduled inventory-expiry invocations')));
}

function checkProductionRetention(config: EnvConfig) {
  const templates = buildProdData(config);
  const cluster = resources(templates.data, 'AWS::RDS::DBCluster')[0][1];
  assert.equal(cluster.DeletionPolicy, 'Retain');
  assert.equal(cluster.UpdateReplacePolicy, 'Retain');
  assert.ok(JSON.stringify(templates.data).includes('isolateddataSubnet'));
}

function checkFutureZeroNatNetwork(config: EnvConfig, defaultNetworkTemplate: CfnTemplate) {
  const app = new App();
  const network = new NetworkStack(app, 'SugarSocietySc-dev-Network', config, {
    env: { account: config.account, region: config.region },
  });
  const zeroNatTemplate = cfnTemplate(Template.fromStack(network));
  assert.equal(resources(zeroNatTemplate, 'AWS::EC2::NatGateway').length, 0);
  const privateSubnetIds = (template: CfnTemplate) => resources(template, 'AWS::EC2::Subnet')
    .map(([logicalId]) => logicalId)
    .filter((logicalId) => logicalId.includes('Vpcprivateegress'));
  assert.deepEqual(privateSubnetIds(zeroNatTemplate), privateSubnetIds(defaultNetworkTemplate));
  assert.equal(resources(zeroNatTemplate, 'AWS::EC2::Subnet').length, 6);
}

checkConfigurationValidation();
const defaultConfig = readConfig('dev', {}, true).config;
const pollingTemplates = buildInfrastructure(defaultConfig);
checkPollingTemplate(pollingTemplates);
checkDataAndCompatibilityExports(pollingTemplates);
checkFutureZeroNatNetwork({ ...defaultConfig, natGateways: 0 }, pollingTemplates.network);

const scheduledConfig = readConfig('dev', {
  inventoryExpiryMode: 'scheduled',
  auroraMinCapacity: 0,
}).config;
const scheduledTemplates = buildInfrastructure(scheduledConfig);
checkScheduledTemplate(scheduledTemplates);
const zeroNatTemplates = buildInfrastructure({ ...scheduledConfig, natGateways: 0 });
assert.equal(resources(zeroNatTemplates.network, 'AWS::EC2::NatGateway').length, 0);
assert.deepEqual(zeroNatTemplates.data.Resources, scheduledTemplates.data.Resources,
  'NAT removal must not alter isolated database resources');

const productionConfig = readConfig('prod').config;
checkProductionRetention(productionConfig);
console.log('Lean Data API infrastructure assertions passed.');
