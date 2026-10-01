import { Stack, StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { EnvConfig } from './env-config';

/**
 * Cognito User Pool + Hosted UI. Google (and other OAuth) federation is added in
 * Phase 1 once client id/secret are available in Secrets Manager — the pool/client
 * here already support `supportedIdentityProviders` being extended without rework.
 */
export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

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

    this.userPoolClient = this.userPool.addClient('WebClient', {
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
      },
      // Extend this list (e.g. cognito.UserPoolClientIdentityProvider.GOOGLE) once
      // the Google OAuth IdP is registered on the pool in Phase 1.
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
    });
  }
}
