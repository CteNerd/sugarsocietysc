import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { getCurrentUser, syncProfile } from '../../api/auth-client';
import LoadingSpinner from '../../components/LoadingSpinner';

/** Handles the Cognito Hosted UI redirect after a Google sign-in: exchanges the authorization code
 * for tokens, then either goes straight to the account page (already-synced user) or asks for a phone
 * number first (new Google sign-ups don't have one — Google's basic scopes don't supply it). */
export default function GoogleCallback() {
  const { exchangeGoogleCode } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [profile, setProfile] = useState({ firstName: '', lastName: '', phone: '' });
  const [idToken, setIdTokenLocal] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const exchanged = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code || exchanged.current) {
      return;
    }
    exchanged.current = true;
    exchangeGoogleCode(code)
      .then(async ({ idToken: token, claims }) => {
        setIdTokenLocal(token);
        const existing = await getCurrentUser(token).catch(() => null);
        if (existing?.phone) {
          navigate('/account');
          return;
        }
        setProfile({ firstName: claims.firstName, lastName: claims.lastName, phone: '' });
        setNeedsPhone(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Google sign-in failed'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idToken) {
      return;
    }
    setSubmitting(true);
    try {
      await syncProfile(idToken, profile);
      navigate('/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return <p className="auth-error">{error}</p>;
  }
  if (!needsPhone) {
    return <LoadingSpinner />;
  }

  return (
    <div className="auth-form-container">
      <h1>Finish Setting Up Your Account</h1>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="First name"
          value={profile.firstName}
          onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
          required
        />
        <input
          placeholder="Last name"
          value={profile.lastName}
          onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
          required
        />
        <input
          type="tel"
          placeholder="Phone (e.g. +15555550100)"
          value={profile.phone}
          onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
          required
        />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
