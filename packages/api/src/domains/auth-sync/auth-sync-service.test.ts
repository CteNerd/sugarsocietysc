import { describe, expect, it } from 'vitest';
import { AuthSyncRequest, User } from '@sugarsocietysc/shared';
import { AuthClaims } from '../../auth/verify-jwt';
import { AuthSyncRepository, UpsertUserInput } from './auth-sync-repository';
import { AuthSyncService, isAllowlistedGoogleAdmin } from './auth-sync-service';

function fakeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    cognitoSub: 'sub-1',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '+15555550123',
    role: 'customer',
    newsletterOptInEmail: false,
    newsletterOptInSms: false,
    isActive: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function fakeRepository(
  overrides: Partial<AuthSyncRepository> = {},
): Pick<AuthSyncRepository, 'upsertFromCognito' | 'findByCognitoSub' | 'updateIdentity'> {
  return {
    upsertFromCognito: async (input: UpsertUserInput) =>
      fakeUser({ cognitoSub: input.cognitoSub, email: input.email, role: input.role }),
    findByCognitoSub: async () => undefined,
    updateIdentity: async (sub, email, role) => fakeUser({ cognitoSub: sub, email, role }),
    ...overrides,
  };
}

const claims: AuthClaims = { sub: 'sub-1', email: 'jane@example.com' };
const config = {
  adminEmails: ['admin@sugarsocietysc.com'],
  adminEmailDomain: 'sugarsocietysc.com',
};
const profile: AuthSyncRequest = {
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '+15555550123',
  newsletterOptInEmail: true,
  newsletterOptInSms: false,
};

const googleAdminClaims: AuthClaims = {
  sub: 'admin-sub',
  email: 'admin@sugarsocietysc.com',
  email_verified: true,
  identities: [{ providerName: 'Google' }],
};

describe('AuthSyncService', () => {
  it('upserts the Postgres profile using claims + request body', async () => {
    const repository = fakeRepository();
    const service = new AuthSyncService(repository, config);

    const result = await service.syncUser(claims, profile);

    expect(result.cognitoSub).toBe('sub-1');
    expect(result.email).toBe('jane@example.com');
  });

  it('returns undefined when the current user has not been synced yet', async () => {
    const service = new AuthSyncService(fakeRepository({ findByCognitoSub: async () => undefined }), config);

    const result = await service.getCurrentUser(claims);

    expect(result).toBeUndefined();
  });

  it('returns the synced user when found', async () => {
    const existing = fakeUser();
    const service = new AuthSyncService(fakeRepository({ findByCognitoSub: async () => existing }), config);

    const result = await service.getCurrentUser(claims);

    expect(result).toEqual(existing);
  });

  it('promotes only allowlisted, verified Google identities on the configured domain', () => {
    expect(isAllowlistedGoogleAdmin({
      sub: 'admin-sub',
      email: 'admin@sugarsocietysc.com',
      email_verified: true,
      identities: [{ providerName: 'Google' }],
      hd: 'sugarsocietysc.com',
    }, config)).toBe(true);
    expect(isAllowlistedGoogleAdmin({
      sub: 'admin-sub',
      email: 'admin@sugarsocietysc.com',
      email_verified: true,
    }, config)).toBe(false);
  });

  it('demotes an existing admin if the email is no longer allowlisted', async () => {
    const repository = fakeRepository({
      findByCognitoSub: async () => fakeUser({
        email: 'admin@sugarsocietysc.com',
        role: 'admin',
      }),
    });
    let requestedRole = '';
    repository.upsertFromCognito = async (input) => {
      requestedRole = input.role;
      return fakeUser({ role: input.role });
    };
    const service = new AuthSyncService(repository, { ...config, adminEmails: [] });

    await service.syncUser({
      sub: 'sub-1',
      email: 'admin@sugarsocietysc.com',
      email_verified: true,
      identities: [{ providerName: 'Google' }],
    }, profile);

    expect(requestedRole).toBe('customer');
  });

  it.each([
    { identities: JSON.stringify([{ providerName: 'Google' }]), email_verified: 'true' },
    { email: ' ADMIN@SUGARSOCIETYSC.COM ', hd: 'SugarSocietySc.com' },
  ])('accepts supported verified Google claim formats: %j', (overrides) => {
    expect(isAllowlistedGoogleAdmin({ ...googleAdminClaims, ...overrides }, config)).toBe(true);
  });

  it.each([
    { email_verified: false },
    { email_verified: undefined },
    { identities: undefined },
    { identities: '{invalid' },
    { identities: [{ providerName: 'Facebook' }] },
    { hd: 'another-company.com' },
    { email: 'customer@sugarsocietysc.com' },
    { email: 'admin@another-company.com' },
  ])('rejects ineligible identities: %j', (overrides) => {
    expect(isAllowlistedGoogleAdmin({ ...googleAdminClaims, ...overrides }, config)).toBe(false);
  });

  it('reconciles an existing customer on session restoration without rewriting contact or preferences', async () => {
    const existing = fakeUser({ email: googleAdminClaims.email, newsletterOptInSms: true });
    let update: { sub: string; email: string; role: User['role'] } | undefined;
    const repository = fakeRepository({
      findByCognitoSub: async () => existing,
      updateIdentity: async (sub, email, role) => {
        update = { sub, email, role };
        return { ...existing, email, role };
      },
      upsertFromCognito: async () => { throw new Error('Must not rewrite the profile'); },
    });
    const result = await new AuthSyncService(repository, config).getCurrentUser(googleAdminClaims);
    expect(update).toEqual({ sub: googleAdminClaims.sub, email: googleAdminClaims.email, role: 'admin' });
    expect(result).toEqual({ ...existing, role: 'admin' });
  });

  it('reconciles removed admins and non-Google sessions to customers', async () => {
    const existing = fakeUser({ role: 'admin', email: googleAdminClaims.email });
    const repository = fakeRepository({ findByCognitoSub: async () => existing });
    expect((await new AuthSyncService(repository, { ...config, adminEmails: [] })
      .getCurrentUser(googleAdminClaims))?.role).toBe('customer');
    expect((await new AuthSyncService(repository, config)
      .getCurrentUser({ sub: googleAdminClaims.sub, email: googleAdminClaims.email }))?.role).toBe('customer');
  });

  it('does not grant inactive users admin access on sync or restoration', async () => {
    const existing = fakeUser({ role: 'admin', isActive: false, email: googleAdminClaims.email });
    const repository = fakeRepository({
      findByCognitoSub: async () => existing,
      upsertFromCognito: async (input) => ({ ...existing, role: input.role }),
      updateIdentity: async (_sub, _email, role) => ({ ...existing, role }),
    });
    const service = new AuthSyncService(repository, config);
    expect(await service.getCurrentUser(googleAdminClaims)).toMatchObject({ role: 'customer', isActive: false });
    expect(await service.syncUser(googleAdminClaims, profile)).toMatchObject({ role: 'customer', isActive: false });
  });
});
