import { AuthSyncRequest, User } from '@sugarsocietysc/shared';
import { AuthClaims } from '../../auth/verify-jwt';
import { AuthSyncRepository } from './auth-sync-repository';
import { AppConfig } from '../../config/env';

export class AuthSyncService {
  constructor(
    private readonly repository: AuthSyncRepository,
    private readonly config: Pick<AppConfig, 'adminEmails' | 'adminEmailDomain'>,
  ) {}

  async syncUser(claims: AuthClaims, profile: AuthSyncRequest): Promise<User> {
    const role = isAllowlistedGoogleAdmin(claims, this.config) ? 'admin' : 'customer';
    const existing = await this.repository.findByCognitoSub(claims.sub);
    if ((existing?.role ?? 'customer') !== role && (existing || role === 'admin')) {
      console.info('User role changed during auth sync', {
        cognitoSub: claims.sub,
        previousRole: existing?.role ?? 'none',
        newRole: role,
      });
    }
    return this.repository.upsertFromCognito({
      cognitoSub: claims.sub,
      email: claims.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      role,
      newsletterOptInEmail: profile.newsletterOptInEmail,
      newsletterOptInSms: profile.newsletterOptInSms,
    });
  }

  async getCurrentUser(claims: AuthClaims): Promise<User | undefined> {
    return this.repository.findByCognitoSub(claims.sub);
  }
}

export function isAllowlistedGoogleAdmin(
  claims: AuthClaims,
  config: Pick<AppConfig, 'adminEmails' | 'adminEmailDomain'>,
): boolean {
  const email = claims.email.trim().toLowerCase();
  const domain = config.adminEmailDomain.trim().toLowerCase();
  const identitiesClaim = claims.identities;
  let identities: unknown = identitiesClaim;
  if (typeof identitiesClaim === 'string') {
    try {
      identities = JSON.parse(identitiesClaim);
    } catch {
      return false;
    }
  }
  const googleFederated = Array.isArray(identities) && identities.some(
    (identity) =>
      typeof identity === 'object' &&
      identity !== null &&
      'providerName' in identity &&
      typeof identity.providerName === 'string' &&
      identity.providerName.toLowerCase() === 'google',
  );
  const verifiedEmail = claims.email_verified === true || claims.email_verified === 'true';
  const hostedDomain = claims.hd;
  const hostedDomainMatches =
    hostedDomain === undefined ||
    (typeof hostedDomain === 'string' && hostedDomain.trim().toLowerCase() === domain);
  return (
    googleFederated &&
    verifiedEmail &&
    hostedDomainMatches &&
    email.endsWith(`@${domain}`) &&
    config.adminEmails.some((allowedEmail) => allowedEmail.trim().toLowerCase() === email)
  );
}
