import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  AdminConfirmSignUpCommand,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:9229',
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

const UserPoolId = 'local_0Hm67WI3';
const ClientId = '7efs0upi2lg2kd5gu04s3brv6';
const email = `smoke-${Date.now()}@example.com`;
const password = 'Sm0keTest!2345';

async function main() {
  await client.send(
    new SignUpCommand({
      ClientId,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'given_name', Value: 'Smoke' },
        { Name: 'family_name', Value: 'Test' },
        { Name: 'phone_number', Value: '+15555550100' },
      ],
    }),
  );
  console.log('Signed up:', email);

  await client.send(new AdminConfirmSignUpCommand({ UserPoolId, Username: email }));
  console.log('Confirmed');

  const auth = await client.send(
    new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    }),
  );
  const idToken = auth.AuthenticationResult?.IdToken;
  if (!idToken) throw new Error('No ID token returned');
  console.log('Got ID token, length:', idToken.length);
  (await import('node:fs')).writeFileSync('/tmp/id-token.txt', idToken);

  const syncRes = await fetch('http://localhost:3001/auth-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({
      firstName: 'Smoke',
      lastName: 'Test',
      phone: '+15555550100',
      newsletterOptInEmail: true,
      newsletterOptInSms: false,
    }),
  });
  console.log('auth-sync POST status:', syncRes.status);
  console.log(await syncRes.json());

  const meRes = await fetch('http://localhost:3001/auth-sync/me', {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  console.log('auth-sync GET /me status:', meRes.status);
  console.log(await meRes.json());

  const noAuthRes = await fetch('http://localhost:3001/auth-sync/me');
  console.log('no-auth status (expect 401):', noAuthRes.status);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
