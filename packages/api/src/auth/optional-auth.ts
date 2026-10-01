import { createMiddleware } from 'hono/factory';
import { AppConfig } from '../config/env';
import { AuthClaims, verifyIdToken } from './verify-jwt';

/**
 * Like `requireAuth`, but never 401s — attaches `authClaims` when a valid bearer token is present,
 * otherwise leaves it unset so the route can treat the caller as a guest. Used for endpoints (like
 * Pre-Sale checkout) that support both signed-in and guest customers.
 */
export function optionalAuth(config: AppConfig) {
  return createMiddleware<{ Variables: { authClaims?: AuthClaims } }>(async (c, next) => {
    const header = c.req.header('Authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (token) {
      try {
        const claims = await verifyIdToken(
          token,
          config.cognitoJwksUri,
          config.cognitoIssuer,
          config.cognitoClientId,
        );
        c.set('authClaims', claims);
      } catch {
        // Invalid/expired token on an optional-auth route: treat the caller as a guest rather than
        // failing the request outright.
      }
    }
    await next();
  });
}
