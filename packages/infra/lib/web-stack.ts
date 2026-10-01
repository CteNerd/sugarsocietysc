import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvConfig } from './env-config';

/**
 * Static frontend hosting: private S3 bucket behind CloudFront (Origin Access Control),
 * replacing GitHub Pages. This domain's real DNS lives outside AWS (Squarespace/Google Domains, not
 * Route53) — the ACM cert is validated manually there and imported here by ARN, and the CNAME pointing
 * `domainName` at this distribution must also be created manually there (see the `WebDistributionDomain`
 * output). CDK never touches Route53 for this domain.
 */
export class WebStack extends Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, envConfig: EnvConfig, props?: StackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, 'WebBucket', {
      bucketName: `sugarsocietysc-web-${envConfig.envName}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: envConfig.envName === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: envConfig.envName !== 'prod',
    });

    const certificate = acm.Certificate.fromCertificateArn(this, 'WebCertificate', envConfig.certificateArn);

    this.distribution = new cloudfront.Distribution(this, 'WebDistribution', {
      domainNames: [envConfig.domainName],
      certificate,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        // React Router SPA fallback
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    new CfnOutput(this, 'WebDistributionDomain', {
      description: `Create a CNAME for ${envConfig.domainName} pointing here in the external DNS provider`,
      value: this.distribution.distributionDomainName,
    });
  }
}
