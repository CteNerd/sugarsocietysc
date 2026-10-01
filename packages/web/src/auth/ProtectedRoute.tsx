import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { idToken, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }
  if (!idToken) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
