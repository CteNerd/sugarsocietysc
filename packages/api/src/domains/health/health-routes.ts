import { Hono } from 'hono';
import { SqlDatabase } from '../../ports/database/ISqlDatabase';
import { HealthService } from './health-service';

export function healthRoutes(pool: SqlDatabase): Hono {
  const app = new Hono();
  const service = new HealthService(pool);

  app.get('/', async (c) => {
    const result = await service.check();
    return c.json(result, result.status === 'ok' ? 200 : 503);
  });

  return app;
}
