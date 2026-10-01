import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvConfig } from './env-config';

/**
 * Cognito User Pool + Hosted UI. Google federation is wired up but stays inactive until
 * `envConfig.googleOAuthClientId` is set — register the real client in Google Cloud Console first
 * (redirect URI = the `GoogleRedirectUri` stack output), then redeploy with the client ID set and the
 * matching client secret populated in the `GoogleOAuthClientSecret` output's Secrets Manager entry.
 */
export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, envConfig: EnvConfig, props?: StackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `sugarsocietysc-${envConfig.envName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 10,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      standardAttributes: {
        givenName: { required: true, mutable: true },
        familyName: { required: true, mutable: true },
        phoneNumber: { required: true, mutable: true },
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
    });

    this.userPoolDomain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: { domainPrefix: `sugarsocietysc-cookies-${envConfig.envName}` },
    });

    // Placeholder at creation time only (CloudFormation does not reset GenerateSecretString on
    // update) — populate the real value with `aws secretsmanager put-secret-value` after creating
    // the Google OAuth client, never through source control or chat.
    const googleOAuthSecret = new secretsmanager.Secret(this, 'GoogleOAuthClientSecret', {
      secretName: `sugarsocietysc/${envConfig.envName}/google-oauth-client-secret`,
      description: 'Google OAuth client secret for Cognito federation — populate manually, CDK only creates the placeholder.',
    });

    const googleEnabled = envConfig.googleOAuthClientId.length > 0;
    let googleProvider: cognito.UserPoolIdentityProviderGoogle | undefined;
    if (googleEnabled) {
      googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleIdP', {
        userPool: this.userPool,
        clientId: envConfig.googleOAuthClientId,
        clientSecretValue: googleOAuthSecret.secretValue,
        scopes: ['profile', 'email', 'openid'],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
          familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
        },
      });
    }

    this.userPoolClient = this.userPool.addClient('WebClient', {
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        // Local CRA dev server today; add the CloudFront/custom domain once the Web stack cutover
        // (Phase 9) is live — Cognito clients support multiple registered URLs.
        callbackUrls: ['http://localhost:3000/account', 'http://localhost:3000/login'],
        logoutUrls: ['http://localhost:3000/login'],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
        ...(googleEnabled ? [cognito.UserPoolClientIdentityProvider.GOOGLE] : []),
      ],
    });
    if (googleProvider) {
      this.userPoolClient.node.addDependency(googleProvider);
    }

    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId });
    new CfnOutput(this, 'CognitoHostedUiDomain', {
      value: `https://${this.userPoolDomain.domainName}.auth.${envConfig.region}.amazoncognito.com`,
    });
    new CfnOutput(this, 'GoogleRedirectUri', {
      description: 'Register this exact URL as an authorized redirect URI on the Google OAuth client',
      value: `https://${this.userPoolDomain.domainName}.auth.${envConfig.region}.amazoncognito.com/oauth2/idpresponse`,
    });
    new CfnOutput(this, 'GoogleOAuthClientSecretArn', { value: googleOAuthSecret.secretArn });
  }
}

