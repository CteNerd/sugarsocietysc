import {
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
  CreateUserPoolCommand,
  ListUserPoolClientsCommand,
  ListUserPoolsCommand,
} from '@aws-sdk/client-cognito-identity-provider';

/**
 * One-time local setup: creates a fixed-name User Pool + client against cognito-local (idempotent —
 * safe to re-run) and prints the IDs to paste into .env.local as COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID.
 * Real AWS deploys get these from the CDK AuthStack instead — this script is local-dev only.
 */
const POOL_NAME = 'sugarsocietysc-local';
const CLIENT_NAME = 'sugarsocietysc-local-web';

const client = new CognitoIdentityProviderClient({
  region: 'us-east-1',
  endpoint: process.env.COGNITO_ENDPOINT ?? 'http://localhost:9229',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

async function main() {
  const pools = await client.send(new ListUserPoolsCommand({ MaxResults: 60 }));
  let userPoolId = pools.UserPools?.find((p) => p.Name === POOL_NAME)?.Id;

  if (!userPoolId) {
    const created = await client.send(new CreateUserPoolCommand({ PoolName: POOL_NAME }));
    userPoolId = created.UserPool?.Id;
  }
  if (!userPoolId) {
    throw new Error('Failed to create or find local Cognito user pool');
  }

  const clients = await client.send(new ListUserPoolClientsCommand({ UserPoolId: userPoolId }));
  let clientId = clients.UserPoolClients?.find((c) => c.ClientName === CLIENT_NAME)?.ClientId;

  if (!clientId) {
    const created = await client.send(
      new CreateUserPoolClientCommand({
        UserPoolId: userPoolId,
        ClientName: CLIENT_NAME,
        ExplicitAuthFlows: ['ALLOW_USER_SRP_AUTH', 'ALLOW_USER_PASSWORD_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
      }),
    );
    clientId = created.UserPoolClient?.ClientId;
  }

  // eslint-disable-next-line no-console
  console.log('Add these to .env.local:');
  // eslint-disable-next-line no-console
  console.log(`COGNITO_USER_POOL_ID=${userPoolId}`);
  // eslint-disable-next-line no-console
  console.log(`COGNITO_CLIENT_ID=${clientId}`);
  // cognito-local always embeds "0.0.0.0" (not "localhost") as the host in the `iss` claim it issues,
  // regardless of request host — the issuer env var must match that exactly or JWT verification fails.
  // eslint-disable-next-line no-console
  console.log(`COGNITO_ISSUER_URL=http://0.0.0.0:9229/${userPoolId}`);
  // eslint-disable-next-line no-console
  console.log(`REACT_APP_COGNITO_USER_POOL_ID=${userPoolId}`);
  // eslint-disable-next-line no-console
  console.log(`REACT_APP_COGNITO_CLIENT_ID=${clientId}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
