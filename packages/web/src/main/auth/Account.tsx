import React, { useEffect, useState } from 'react';
import { User } from '@sugarsocietysc/shared';
import { useAuth } from '../../auth/AuthContext';
import { getCurrentUser } from '../../api/auth-client';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function Account() {
  const { idToken, signOut } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idToken) {
      return;
    }
    getCurrentUser(idToken)
      .then(setUser)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load profile'));
  }, [idToken]);

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
      <button type="button" onClick={signOut}>
        Log Out
      </button>
    </div>
  );
}
