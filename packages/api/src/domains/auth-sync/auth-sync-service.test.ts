import { describe, expect, it } from 'vitest';
import { AuthSyncRequest, User } from '@sugarsocietysc/shared';
import { AuthClaims } from '../../auth/verify-jwt';
import { AuthSyncRepository, UpsertUserInput } from './auth-sync-repository';
import { AuthSyncService } from './auth-sync-service';

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

function fakeRepository(overrides: Partial<AuthSyncRepository> = {}): AuthSyncRepository {
  return {
    upsertFromCognito: async (input: UpsertUserInput) =>
      fakeUser({ cognitoSub: input.cognitoSub, email: input.email }),
    findByCognitoSub: async () => undefined,
    ...overrides,
  } as unknown as AuthSyncRepository;
}

const claims: AuthClaims = { sub: 'sub-1', email: 'jane@example.com' };
const profile: AuthSyncRequest = {
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '+15555550123',
  newsletterOptInEmail: true,
  newsletterOptInSms: false,
};

describe('AuthSyncService', () => {
  it('upserts the Postgres profile using claims + request body', async () => {
    const repository = fakeRepository();
    const service = new AuthSyncService(repository);

    const result = await service.syncUser(claims, profile);

    expect(result.cognitoSub).toBe('sub-1');
    expect(result.email).toBe('jane@example.com');
  });

  it('returns undefined when the current user has not been synced yet', async () => {
    const service = new AuthSyncService(fakeRepository({ findByCognitoSub: async () => undefined }));

    const result = await service.getCurrentUser(claims);

    expect(result).toBeUndefined();
  });

  it('returns the synced user when found', async () => {
    const existing = fakeUser();
    const service = new AuthSyncService(fakeRepository({ findByCognitoSub: async () => existing }));

    const result = await service.getCurrentUser(claims);

    expect(result).toEqual(existing);
  });
});
