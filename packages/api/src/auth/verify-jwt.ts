import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AuthClaims {
  sub: string;
  email: string;
  [key: string]: unknown;
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(jwksUri: string) {
  let jwks = jwksCache.get(jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri));
    jwksCache.set(jwksUri, jwks);
  }
  return jwks;
}

/** Verifies a Cognito-issued ID token against the pool's JWKS (works for cognito-local and real Cognito). */
export async function verifyIdToken(token: string, jwksUri: string, issuer: string): Promise<AuthClaims> {
  const jwks = getJwks(jwksUri);
  const { payload } = await jwtVerify(token, jwks, { issuer });
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
    throw new Error('Token missing required sub/email claims');
  }
  return payload as AuthClaims;
}
