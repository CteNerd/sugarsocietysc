/**
 * Central runtime config. Provider selection (sms/payment/storage) lives here so swapping
 * a vendor (e.g. SNS -> Twilio) is a one-line change, never a change to calling code.
 */
export interface AppConfig {
  databaseUrl: string;
  smsProvider: 'sns' | 'twilio';
  emailProvider: 'ses';
  paymentProvider: 'stripe';
  storageProvider: 's3';
  uploadsBucketName: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  guestPiiRetentionDays: number;
  awsRegion: string;
}

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  return {
    databaseUrl: requireEnv('DATABASE_URL'),
    smsProvider: (process.env.SMS_PROVIDER as AppConfig['smsProvider']) ?? 'sns',
    emailProvider: 'ses',
    paymentProvider: 'stripe',
    storageProvider: 's3',
    uploadsBucketName: requireEnv('UPLOADS_BUCKET_NAME', 'local-uploads'),
    stripeSecretKey: requireEnv('STRIPE_SECRET_KEY', 'sk_test_placeholder'),
    stripeWebhookSecret: requireEnv('STRIPE_WEBHOOK_SECRET', 'whsec_placeholder'),
    guestPiiRetentionDays: Number(process.env.GUEST_PII_RETENTION_DAYS ?? 60),
    awsRegion: requireEnv('AWS_REGION', 'us-east-1'),
  };
}
