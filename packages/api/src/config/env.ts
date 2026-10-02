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
  uploadsPublicBaseUrl: string;
  awsEndpointUrl?: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  guestPiiRetentionDays: number;
  contactRecipients: string[];
  contactQueueUrl?: string;
  googleRecaptchaSecret?: string;
  newsletterQueueUrl?: string;
  newsletterFromEmail?: string;
  newsletterSiteUrl?: string;
  newsletterSignature?: string;
  awsRegion: string;
  cognitoIssuer: string;
  cognitoJwksUri: string;
  cognitoClientId: string;
  adminEmails: string[];
  adminEmailDomain: string;
}

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  const cognitoIssuer = requireEnv('COGNITO_ISSUER_URL', 'http://localhost:9229/local_placeholder');
  const guestPiiRetentionDays = Number(process.env.GUEST_PII_RETENTION_DAYS ?? 60);
  if (!Number.isSafeInteger(guestPiiRetentionDays) || guestPiiRetentionDays < 1) {
    throw new Error('GUEST_PII_RETENTION_DAYS must be a positive integer');
  }

  return {
    databaseUrl: requireEnv('DATABASE_URL'),
    smsProvider: (process.env.SMS_PROVIDER as AppConfig['smsProvider']) ?? 'sns',
    emailProvider: 'ses',
    paymentProvider: 'stripe',
    storageProvider: 's3',
    uploadsBucketName: requireEnv('UPLOADS_BUCKET_NAME', 'local-uploads'),
    uploadsPublicBaseUrl: requireEnv('UPLOADS_PUBLIC_BASE_URL', 'http://localhost:4566/local-uploads'),
    awsEndpointUrl: process.env.AWS_ENDPOINT_URL,
    stripeSecretKey: requireEnv('STRIPE_SECRET_KEY', 'sk_test_placeholder'),
    stripeWebhookSecret: requireEnv('STRIPE_WEBHOOK_SECRET', 'whsec_placeholder'),
    guestPiiRetentionDays,
    contactRecipients: (process.env.CONTACT_RECIPIENTS
      ?? 'ashuah.tomlin@sugarsocietysc.com,admin@sugarsocietysc.com')
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean),
    contactQueueUrl: process.env.CONTACT_QUEUE_URL,
    googleRecaptchaSecret: process.env.GOOGLE_RECAPTCHA_SECRET,
    newsletterQueueUrl: process.env.NEWSLETTER_QUEUE_URL,
    newsletterFromEmail: process.env.NEWSLETTER_FROM_EMAIL ?? 'newsletter@sugarsocietysc.com',
    newsletterSiteUrl: process.env.NEWSLETTER_SITE_URL ?? 'https://www.sugarsocietysc.com',
    newsletterSignature: process.env.NEWSLETTER_SIGNATURE ?? 'Sugar Society Sugar Cookies',
    awsRegion: requireEnv('AWS_REGION', 'us-east-1'),
    cognitoIssuer,
    cognitoJwksUri: `${cognitoIssuer}/.well-known/jwks.json`,
    cognitoClientId: requireEnv('COGNITO_CLIENT_ID', 'local_placeholder'),
    adminEmails: (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
    adminEmailDomain: requireEnv('ADMIN_EMAIL_DOMAIN', 'sugarsocietysc.com').trim().toLowerCase(),
  };
}
