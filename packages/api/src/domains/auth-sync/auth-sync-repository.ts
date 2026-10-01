import { Pool } from 'pg';
import { User } from '@sugarsocietysc/shared';

interface UserRow {
  id: string;
  cognito_sub: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: 'customer' | 'admin';
  newsletter_opt_in_email: boolean;
  newsletter_opt_in_sms: boolean;
  is_active: boolean;
  created_at: Date;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    cognitoSub: row.cognito_sub,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    newsletterOptInEmail: row.newsletter_opt_in_email,
    newsletterOptInSms: row.newsletter_opt_in_sms,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
  };
}

export interface UpsertUserInput {
  cognitoSub: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  newsletterOptInEmail?: boolean;
  newsletterOptInSms?: boolean;
}

export class AuthSyncRepository {
  constructor(private readonly pool: Pool) {}

  async upsertFromCognito(input: UpsertUserInput): Promise<User> {
    const result = await this.pool.query<UserRow>(
      `INSERT INTO users
         (cognito_sub, email, first_name, last_name, phone, newsletter_opt_in_email, newsletter_opt_in_sms)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, false), COALESCE($7, false))
       ON CONFLICT (cognito_sub) DO UPDATE SET
         email = EXCLUDED.email,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         phone = EXCLUDED.phone,
         newsletter_opt_in_email = COALESCE($6, users.newsletter_opt_in_email),
         newsletter_opt_in_sms = COALESCE($7, users.newsletter_opt_in_sms)
       RETURNING *`,
      [
        input.cognitoSub,
        input.email,
        input.firstName,
        input.lastName,
        input.phone,
        input.newsletterOptInEmail ?? null,
        input.newsletterOptInSms ?? null,
      ],
    );
    return toUser(result.rows[0]);
  }

  async findByCognitoSub(cognitoSub: string): Promise<User | undefined> {
    const result = await this.pool.query<UserRow>('SELECT * FROM users WHERE cognito_sub = $1', [
      cognitoSub,
    ]);
    return result.rows[0] ? toUser(result.rows[0]) : undefined;
  }
}
