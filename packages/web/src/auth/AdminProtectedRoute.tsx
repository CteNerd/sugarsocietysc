import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { getCurrentUser } from '../api/auth-client';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AdminProtectedRoute({ children }: { children: React.ReactElement }) {
  const { idToken, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!idToken) {
      setIsAdmin(false);
      return () => {
        active = false;
      };
    }

    getCurrentUser(idToken)
      .then((user) => {
        if (active) {
          setIsAdmin(user.role === 'admin');
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Could not verify administrator access');
          setIsAdmin(false);
        }
      });

    return () => {
      active = false;
    };
  }, [idToken]);

  if (loading || (idToken && isAdmin === null)) {
    return <LoadingSpinner />;
  }
  if (!idToken) {
    return <Navigate to="/login" replace />;
  }
  if (error) {
    return <p className="auth-error">{error}</p>;
  }
  if (!isAdmin) {
    return <p className="auth-error">You do not have administrator access.</p>;
  }
  return children;
}
