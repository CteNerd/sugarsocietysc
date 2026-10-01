import { AuthSyncRequest, User } from '@sugarsocietysc/shared';
import { AuthClaims } from '../../auth/verify-jwt';
import { AuthSyncRepository } from './auth-sync-repository';

export class AuthSyncService {
  constructor(private readonly repository: AuthSyncRepository) {}

  async syncUser(claims: AuthClaims, profile: AuthSyncRequest): Promise<User> {
    return this.repository.upsertFromCognito({
      cognitoSub: claims.sub,
      email: claims.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      newsletterOptInEmail: profile.newsletterOptInEmail,
      newsletterOptInSms: profile.newsletterOptInSms,
    });
  }

  async getCurrentUser(claims: AuthClaims): Promise<User | undefined> {
    return this.repository.findByCognitoSub(claims.sub);
  }
}
