import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AdminProtectedRoute({ children }: { children: React.ReactElement }) {
  const { idToken, loading, user, profileLoading, profileError, refreshProfile } = useAuth();

  if (loading || profileLoading) return <LoadingSpinner />;
  if (!idToken) return <Navigate to="/login" replace />;
  if (profileError) {
    return (
      <div className="auth-form-container">
        <p className="auth-error" role="alert">Could not verify administrator access: {profileError}</p>
        <button type="button" onClick={() => { void refreshProfile(); }}>Retry verification</button>
      </div>
    );
  }
  if (!user) return <Navigate to="/account" replace />;
  if (!user.isActive || user.role !== 'admin') {
    return (
      <div className="auth-form-container">
        <p className="auth-error" role="alert">You do not have administrator access.</p>
        <p>Administrators must use Google sign-in with an approved, verified company account.</p>
        <Link to="/account">Back to my account</Link>
      </div>
    );
  }
  return children;
}
