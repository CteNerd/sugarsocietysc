import { AuthSyncRequest, User } from '@sugarsocietysc/shared';
import { AuthClaims } from '../../auth/verify-jwt';
import { AuthSyncRepository } from './auth-sync-repository';
import { AppConfig } from '../../config/env';

export class AuthSyncService {
  constructor(
    private readonly repository: Pick<AuthSyncRepository, 'findByCognitoSub' | 'upsertFromCognito' | 'updateIdentity'>,
    private readonly config: Pick<AppConfig, 'adminEmails' | 'adminEmailDomain'>,
  ) {}

  async syncUser(claims: AuthClaims, profile: AuthSyncRequest): Promise<User> {
    const existing = await this.repository.findByCognitoSub(claims.sub);
    const role = existing?.isActive === false ? 'customer' : this.roleFor(claims);
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
    const existing = await this.repository.findByCognitoSub(claims.sub);
    if (!existing) return undefined;
    const role = existing.isActive ? this.roleFor(claims) : 'customer';
    if (existing.role === role && existing.email === claims.email) return existing;
    if (existing.role !== role) {
      console.info('User role changed during identity reconciliation', {
        cognitoSub: claims.sub,
        previousRole: existing.role,
        newRole: role,
      });
    }
    return this.repository.updateIdentity(claims.sub, claims.email, role);
  }

  private roleFor(claims: AuthClaims): User['role'] {
    const eligible = isAllowlistedGoogleAdmin(claims, this.config);
    if (!eligible && this.config.adminEmails.some(
      (email) => email.trim().toLowerCase() === claims.email.trim().toLowerCase(),
    )) {
      console.warn('Allowlisted identity did not meet administrator requirements', {
        verifiedEmail: claims.email_verified === true || claims.email_verified === 'true',
        hasFederatedIdentity: claims.identities !== undefined,
        hasHostedDomain: claims.hd !== undefined,
      });
    }
    return eligible ? 'admin' : 'customer';
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
