import { CognitoUserPool } from 'amazon-cognito-identity-js';

export const userPool = new CognitoUserPool({
  UserPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID ?? '',
  ClientId: process.env.REACT_APP_COGNITO_CLIENT_ID ?? '',
  endpoint: process.env.REACT_APP_COGNITO_ENDPOINT,
});

// Hosted UI / OAuth federation (e.g. Google) is AWS-only — cognito-local has no Hosted UI, so these
// only resolve to real values when pointed at a deployed User Pool.
export const hostedUiDomain = process.env.REACT_APP_COGNITO_HOSTED_UI_DOMAIN ?? '';
export const oauthRedirectUri = process.env.REACT_APP_COGNITO_OAUTH_REDIRECT_URI ?? `${window.location.origin}/auth/callback`;

