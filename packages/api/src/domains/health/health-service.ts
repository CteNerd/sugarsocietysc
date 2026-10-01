import { Pool } from 'pg';

export interface HealthResult {
  status: 'ok' | 'degraded';
  dbConnected: boolean;
}

export class HealthService {
  constructor(private readonly pool: Pool) {}

  async check(): Promise<HealthResult> {
    try {
      await this.pool.query('SELECT 1');
      return { status: 'ok', dbConnected: true };
    } catch {
      return { status: 'degraded', dbConnected: false };
    }
  }
}
