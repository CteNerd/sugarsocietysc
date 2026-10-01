import { handle } from 'hono/aws-lambda';
import type { LambdaEvent, LambdaContext } from 'hono/aws-lambda';
import { createApp } from './app';
import { resolveDatabaseUrl } from './config/db-secret';
import { resolveStripeSecrets } from './config/stripe-secret';

let handlerPromise: ReturnType<typeof buildHandler> | undefined;

async function buildHandler() {
  await Promise.all([resolveDatabaseUrl(), resolveStripeSecrets()]);
  return handle(createApp());
}

export const handler = async (event: LambdaEvent, context: LambdaContext) => {
  if (!handlerPromise) {
    handlerPromise = buildHandler();
  }
  const h = await handlerPromise;
  return h(event, context);
};
