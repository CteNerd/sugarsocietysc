import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { updatePreferences } from '../../api/newsletter-client';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function Account() {
  const { idToken, user, profileLoading, profileError, refreshProfile, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  async function handlePreferenceChange(field: 'newsletterOptInEmail' | 'newsletterOptInSms', value: boolean) {
    if (!idToken || !user) {
      return;
    }
    const next = { ...user, [field]: value };
    setSavingPrefs(true);
    try {
      await updatePreferences(idToken, {
        emailOptIn: next.newsletterOptInEmail,
        smsOptIn: next.newsletterOptInSms,
      });
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save preferences');
    } finally {
      setSavingPrefs(false);
    }
  }

  if (profileLoading) {
    return <LoadingSpinner />;
  }
  if (profileError) {
    return (
      <div className="auth-form-container">
        <p className="auth-error" role="alert">{profileError}</p>
        <button type="button" onClick={() => { void refreshProfile(); }}>Retry loading account</button>
      </div>
    );
  }
  if (!user) {
    return <p className="auth-error" role="alert">Your profile has not been set up. Please sign in again to finish account setup.</p>;
  }

  return (
    <div className="auth-form-container">
      <h1>My Account</h1>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <p>
        {user.firstName} {user.lastName}
      </p>
      <p>{user.email}</p>
      <p>{user.phone}</p>
      <p><Link to="/orders">View my orders</Link></p>
      {user.isActive && user.role === 'admin' && <p><Link to="/admin">Open admin dashboard</Link></p>}
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
