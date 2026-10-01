export interface EnvConfig {
  envName: 'dev' | 'prod';
  account: string;
  region: string;
  natGateways: number;
  auroraMinCapacity: number;
  auroraMaxCapacity: number;
  domainName: string;
  guestPiiRetentionDays: number;
}

/** Reads the `environments.<env>` block from cdk.json context (pass -c env=dev|prod). */
export function getEnvConfig(app: import('aws-cdk-lib').App): EnvConfig {
  const envName = app.node.tryGetContext('env') as string | undefined;
  if (!envName) {
    throw new Error('Missing required context: pass -c env=dev or -c env=prod');
  }
  const environments = app.node.tryGetContext('environments') as Record<string, Omit<EnvConfig, 'envName'>>;
  const config = environments[envName];
  if (!config) {
    throw new Error(`No environment config found for "${envName}" in cdk.json`);
  }
  return { envName: envName as 'dev' | 'prod', ...config };
}
