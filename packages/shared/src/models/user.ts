export type UserRole = 'customer' | 'admin';

export interface User {
  id: string;
  cognitoSub: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  newsletterOptInEmail: boolean;
  newsletterOptInSms: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface HolidayPreference {
  userId: string;
  holidayTag: string;
}
