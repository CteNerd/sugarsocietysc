import React, { useEffect, useState } from 'react';
import { User } from '@sugarsocietysc/shared';
import { useAuth } from '../../auth/AuthContext';
import { getCurrentUser } from '../../api/auth-client';
import { updatePreferences } from '../../api/newsletter-client';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function Account() {
  const { idToken, signOut } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (!idToken) {
      return;
    }
    getCurrentUser(idToken)
      .then(setUser)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load profile'));
  }, [idToken]);

  async function handlePreferenceChange(field: 'newsletterOptInEmail' | 'newsletterOptInSms', value: boolean) {
    if (!idToken || !user) {
      return;
    }
    const next = { ...user, [field]: value };
    setUser(next);
    setSavingPrefs(true);
    try {
      await updatePreferences(idToken, {
        emailOptIn: next.newsletterOptInEmail,
        smsOptIn: next.newsletterOptInSms,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save preferences');
    } finally {
      setSavingPrefs(false);
    }
  }

  if (error) {
    return <p className="auth-error">{error}</p>;
  }
  if (!user) {
    return <LoadingSpinner />;
  }

  return (
    <div className="auth-form-container">
      <h1>My Account</h1>
      <p>
        {user.firstName} {user.lastName}
      </p>
      <p>{user.email}</p>
      <p>{user.phone}</p>
      <fieldset disabled={savingPrefs}>
        <legend>Newsletter Preferences</legend>
        <label>
          <input
            type="checkbox"
            checked={user.newsletterOptInEmail}
            onChange={(e) => handlePreferenceChange('newsletterOptInEmail', e.target.checked)}
          />
          Email updates
        </label>
        <label>
          <input
            type="checkbox"
            checked={user.newsletterOptInSms}
            onChange={(e) => handlePreferenceChange('newsletterOptInSms', e.target.checked)}
          />
          SMS updates
        </label>
      </fieldset>
      <button type="button" onClick={signOut}>
        Log Out
      </button>
    </div>
  );
}

