import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
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
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD, s3.HttpMethods.PUT],
        allowedOrigins: [`https://${envConfig.domainName}`, 'http://localhost:3000'],
        allowedHeaders: ['content-type'],
        exposedHeaders: ['ETag'],
        maxAge: 3600,
      }],
    });

    const certificate = acm.Certificate.fromCertificateArn(this, 'WebCertificate', envConfig.certificateArn);
    const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      defaultAction: { allow: {} },
      scope: 'CLOUDFRONT',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `SugarSocietyWebAcl-${envConfig.envName}`,
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 10,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `CommonRules-${envConfig.envName}`,
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 20,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `KnownBadInputs-${envConfig.envName}`,
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    this.distribution = new cloudfront.Distribution(this, 'WebDistribution', {
      domainNames: [envConfig.domainName],
      certificate,
      webAclId: webAcl.attrArn,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        // React Router SPA fallback — S3 (via OAC, no ListBucket grant) returns 403 for missing keys,
        // not 404, so both must be mapped or every client-side route 403s instead of loading the app.
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    new CfnOutput(this, 'WebDistributionDomain', {
      description: `Create a CNAME for ${envConfig.domainName} pointing here in the external DNS provider`,
      value: this.distribution.distributionDomainName,
    });
    new CfnOutput(this, 'WebDistributionId', {
      description: 'CloudFront distribution ID used by the deployment workflow for invalidations',
      value: this.distribution.distributionId,
    });
    new CfnOutput(this, 'WebBucketName', {
      description: 'Private S3 bucket used by the deployment workflow for static assets',
      value: this.bucket.bucketName,
    });
  }
}
