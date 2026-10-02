import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

let resolved: Promise<void> | undefined;

export function parseGoogleRecaptchaSecret(secretString: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(secretString);
  } catch {
    throw new Error('Google reCAPTCHA secret must be a JSON object containing a secretKey');
  }

  if (
    typeof parsed !== 'object'
    || parsed === null
    || !('secretKey' in parsed)
    || typeof parsed.secretKey !== 'string'
    || !parsed.secretKey.trim()
  ) {
    throw new Error('Google reCAPTCHA secret must contain a non-empty secretKey');
  }

  return parsed.secretKey;
}

/** Resolves the Google reCAPTCHA verification secret at cold start in deployed Lambdas. */
export function resolveGoogleRecaptchaSecret(): Promise<void> {
  if (process.env.GOOGLE_RECAPTCHA_SECRET) {
    return Promise.resolve();
  }
  if (!resolved) {
    resolved = (async () => {
      const secretArn = process.env.GOOGLE_RECAPTCHA_SECRET_ARN;
      if (!secretArn) {
        return;
      }
      const client = new SecretsManagerClient({});
      const result = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
      if (!result.SecretString) {
        throw new Error('Google reCAPTCHA secret is empty');
      }
      process.env.GOOGLE_RECAPTCHA_SECRET = parseGoogleRecaptchaSecret(result.SecretString);
    })();
  }
  return resolved;
}
