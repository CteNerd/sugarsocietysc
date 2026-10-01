import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

let resolved: Promise<void> | undefined;

/** Builds DATABASE_URL from Secrets Manager + DB_HOST/PORT/NAME at cold start (deployed Lambda only —
 * local dev sets DATABASE_URL directly in .env.local, so this is a no-op there). */
export function resolveDatabaseUrl(): Promise<void> {
  if (process.env.DATABASE_URL) {
    return Promise.resolve();
  }
  if (!resolved) {
    resolved = (async () => {
      const secretArn = process.env.DB_SECRET_ARN;
      if (!secretArn) {
        return;
      }
      const client = new SecretsManagerClient({});
      const result = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
      const secret = JSON.parse(result.SecretString ?? '{}') as { username: string; password: string };
      const host = process.env.DB_HOST;
      const port = process.env.DB_PORT ?? '5432';
      const dbName = process.env.DB_NAME ?? 'sugarsocietysc';
      process.env.DATABASE_URL = `postgres://${encodeURIComponent(secret.username)}:${encodeURIComponent(secret.password)}@${host}:${port}/${dbName}`;
    })();
  }
  return resolved;
}
