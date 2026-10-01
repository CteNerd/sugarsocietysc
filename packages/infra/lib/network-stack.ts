import { Stack, StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { EnvConfig } from './env-config';

/** Shared VPC: isolated subnets for Aurora, private-with-egress subnets for Lambda. */
export class NetworkStack extends Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, envConfig: EnvConfig, props?: StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      // Explicit AZs (rather than maxAzs) avoid an account/region context lookup at synth
      // time, so `cdk synth`/`cdk diff` work without real AWS credentials configured.
      availabilityZones: [`${envConfig.region}a`, `${envConfig.region}b`],
      natGateways: envConfig.natGateways,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        {
          name: 'private-egress',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'isolated-data',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });
  }
}
