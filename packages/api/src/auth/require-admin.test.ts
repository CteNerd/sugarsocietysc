import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { Pool } from 'pg';
import { User } from '@sugarsocietysc/shared';
import { AuthClaims } from './verify-jwt';
import { requireAdminRole } from './require-admin';
import { AuthSyncRepository } from '../domains/auth-sync/auth-sync-repository';

const claims: AuthClaims = {
  sub: 'sub-1',
  email: 'admin@sugarsocietysc.com',
  identities: [{ providerName: 'Google' }],
  email_verified: true,
};
const user: User = {
  id: 'user-1', cognitoSub: claims.sub, email: claims.email, firstName: 'Test',
  lastName: 'Admin', phone: '+15555550123', role: 'admin', isActive: true,
  newsletterOptInEmail: false, newsletterOptInSms: false, createdAt: '2026-10-01T00:00:00Z',
};

afterEach(() => vi.restoreAllMocks());

function appFor(authClaims: AuthClaims, adminEmails = [claims.email]) {
  const app = new Hono<{ Variables: { authClaims: AuthClaims } }>();
  app.use('*', async (c, next) => { c.set('authClaims', authClaims); await next(); });
  app.use('*', requireAdminRole(new Pool(), { adminEmails, adminEmailDomain: 'sugarsocietysc.com' }));
  app.get('/', (c) => c.json({ allowed: true }));
  return app;
}

describe('requireAdminRole', () => {
  it('allows an active verified allowlisted Google admin', async () => {
    vi.spyOn(AuthSyncRepository.prototype, 'findByCognitoSub').mockResolvedValue(user);
    expect((await appFor(claims).request('/')).status).toBe(200);
  });

  it.each([
    { claims: { sub: claims.sub, email: claims.email }, active: true, allowlist: [claims.email] },
    { claims, active: false, allowlist: [claims.email] },
    { claims, active: true, allowlist: [] },
  ])('denies stale admin records when identity or eligibility changes: %j', async (input) => {
    vi.spyOn(AuthSyncRepository.prototype, 'findByCognitoSub').mockResolvedValue({ ...user, isActive: input.active });
    const update = vi.spyOn(AuthSyncRepository.prototype, 'updateIdentity')
      .mockResolvedValue({ ...user, role: 'customer', isActive: input.active });
    expect((await appFor(input.claims, input.allowlist).request('/')).status).toBe(403);
    expect(update).toHaveBeenCalledWith(claims.sub, claims.email, 'customer');
  });

  it('denies unsynced users', async () => {
    vi.spyOn(AuthSyncRepository.prototype, 'findByCognitoSub').mockResolvedValue(undefined);
    expect((await appFor(claims).request('/')).status).toBe(403);
  });
});
