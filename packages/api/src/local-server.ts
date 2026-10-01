import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createApp } from './app';

const port = Number(process.env.PORT ?? 3001);
// Local-dev only: the CRA dev server runs on a different origin, so requests need CORS headers that
// deployed environments get for free from the HTTP API's `corsPreflight` config (see api-stack.ts) —
// adding them here too would risk duplicate/conflicting headers in prod, so this stays local-only.
const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

const app = new Hono();
app.use(
  '*',
  cors({
    origin: webOrigin,
    allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.route('/', createApp());

serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`API dev server listening on http://localhost:${info.port}`);
});
