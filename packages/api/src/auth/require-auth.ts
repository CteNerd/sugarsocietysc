import { createMiddleware } from 'hono/factory';
import { AppConfig } from '../config/env';
import { AuthClaims, verifyIdToken } from './verify-jwt';

/** Attaches the authenticated Cognito claims to context, or 401s. API Gateway also enforces a JWT
 * authorizer in front of protected routes in deployed environments (see infra/lib/api-stack.ts) — this
 * middleware is what makes the same check work in local dev, which has no API Gateway in front of it. */
export function requireAuth(config: AppConfig) {
  return createMiddleware<{ Variables: { authClaims: AuthClaims } }>(async (c, next) => {
    const header = c.req.header('Authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) {
      return c.json({ error: 'Missing bearer token' }, 401);
    }
    try {
      const claims = await verifyIdToken(
        token,
        config.cognitoJwksUri,
        config.cognitoIssuer,
        config.cognitoClientId,
      );
      c.set('authClaims', claims);
    } catch {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }
    await next();
  });
}
