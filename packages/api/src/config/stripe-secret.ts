import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

let resolved: Promise<void> | undefined;

/** Resolves STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET from Secrets Manager at cold start (deployed Lambda
 * only — local dev sets both directly in .env.local, so this is a no-op there). The secret
 * (`sugarsocietysc/<env>/stripe`) is created and populated out-of-band by a human, never by CDK, since
 * real Stripe API keys can't be committed or generated — see docs/ROADMAP.md deployment checkpoint. */
export function resolveStripeSecrets(): Promise<void> {
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_placeholder') {
    return Promise.resolve();
  }
  if (!resolved) {
    resolved = (async () => {
      const secretArn = process.env.STRIPE_SECRET_ARN;
      if (!secretArn) {
        return;
      }
      const client = new SecretsManagerClient({});
      const result = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
      const secret = JSON.parse(result.SecretString ?? '{}') as {
        secretKey: string;
        webhookSecret: string;
      };
      process.env.STRIPE_SECRET_KEY = secret.secretKey;
      process.env.STRIPE_WEBHOOK_SECRET = secret.webhookSecret;
    })();
  }
  return resolved;
}
