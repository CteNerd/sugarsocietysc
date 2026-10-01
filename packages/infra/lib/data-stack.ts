import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import { EnvConfig } from './env-config';

export interface DataStackProps extends StackProps {
  vpc: ec2.Vpc;
}

/** Aurora Serverless v2 PostgreSQL. Credentials live only in Secrets Manager. */
export class DataStack extends Stack {
  public readonly cluster: rds.DatabaseCluster;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, envConfig: EnvConfig, props: DataStackProps) {
    super(scope, id, props);

    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSg', {
      vpc: props.vpc,
      description: 'Security group for API Lambdas that need DB access',
      allowAllOutbound: true,
    });

    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSg', {
      vpc: props.vpc,
      description: 'Security group for Aurora Serverless v2 cluster',
      allowAllOutbound: false,
    });
    dbSecurityGroup.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow API Lambdas to reach Postgres',
    );

    this.cluster = new rds.DatabaseCluster(this, 'AuroraPostgres', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_3,
      }),
      serverlessV2MinCapacity: envConfig.auroraMinCapacity,
      serverlessV2MaxCapacity: envConfig.auroraMaxCapacity,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      writer: rds.ClusterInstance.serverlessV2('Writer'),
      defaultDatabaseName: 'sugarsocietysc',
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      removalPolicy: envConfig.envName === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      storageEncrypted: true,
    });
  }
}
