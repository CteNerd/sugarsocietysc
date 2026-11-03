export interface EnvConfig {
  envName: 'dev' | 'prod';
  account: string;
  region: string;
  natGateways: number;
  auroraMinCapacity: number;
  auroraMaxCapacity: number;
  auroraAutoPauseSeconds: number;
  inventoryExpiryMode: 'polling' | 'scheduled';
  domainName: string;
  guestPiiRetentionDays: number;
  /** Google OAuth client ID (not secret — the client secret lives in Secrets Manager). Empty string
   * disables Google federation until a real client has been registered in Google Cloud Console. */
  googleOAuthClientId: string;
  adminEmails: string[];
  adminEmailDomain: string;
  /** ACM cert (us-east-1, for CloudFront) covering domainName — the domain's real DNS is NOT Route53
   * (it's managed externally, e.g. Squarespace/Google Domains), so this must be validated manually
   * there; CDK only imports it by ARN, never creates or auto-validates a cert via Route53. */
  certificateArn: string;
  /** Email address subscribed to the per-environment SNS alarm topic (API 5xxs, guest-PII purge,
   * inventory-hold expiry, newsletter worker/DLQ). SNS sends a confirmation email on first deploy —
   * someone must click it before notifications start flowing. */
  alertEmail: string;
}

/** Reads the `environments.<env>` block from cdk.json context (pass -c env=dev|prod). */
export function getEnvConfig(app: import('aws-cdk-lib').App): EnvConfig {
  const envName = app.node.tryGetContext('env') as string | undefined;
  if (!envName) {
    throw new Error('Missing required context: pass -c env=dev or -c env=prod');
  }
  const environments = app.node.tryGetContext('environments') as
    Record<string, Partial<Omit<EnvConfig, 'envName'>>>;
  const rawConfig = environments[envName];
  if (!rawConfig) {
    throw new Error(`No environment config found for "${envName}" in cdk.json`);
  }

  const config = {
    ...rawConfig,
    auroraMinCapacity: rawConfig.auroraMinCapacity ?? 0.5,
    auroraAutoPauseSeconds: rawConfig.auroraAutoPauseSeconds ?? 300,
    inventoryExpiryMode: rawConfig.inventoryExpiryMode ?? 'polling',
  } as Omit<EnvConfig, 'envName'>;

  if (!Number.isInteger(config.natGateways) || config.natGateways < 0) {
    throw new Error('natGateways must be a non-negative integer');
  }
  if (config.inventoryExpiryMode !== 'polling' && config.inventoryExpiryMode !== 'scheduled') {
    throw new Error('inventoryExpiryMode must be "polling" or "scheduled"');
  }
  if (!Number.isInteger(config.auroraAutoPauseSeconds)
      || config.auroraAutoPauseSeconds < 300
      || config.auroraAutoPauseSeconds > 86_400) {
    throw new Error('auroraAutoPauseSeconds must be an integer between 300 and 86400');
  }
  if (!Number.isFinite(config.auroraMinCapacity)
      || config.auroraMinCapacity < 0
      || config.auroraMinCapacity > config.auroraMaxCapacity
      || (config.auroraMinCapacity > 0
        && (config.auroraMinCapacity < 0.5 || !Number.isInteger(config.auroraMinCapacity * 2)))
      || (config.auroraMinCapacity === 0 && config.inventoryExpiryMode !== 'scheduled')) {
    throw new Error(
      'auroraMinCapacity must be 0 (only in scheduled mode) or a valid 0.5-ACU increment no greater than auroraMaxCapacity',
    );
  }

  return { envName: envName as 'dev' | 'prod', ...config };
}
