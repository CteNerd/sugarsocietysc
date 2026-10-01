import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { unsubscribe } from '../../api/newsletter-client';

/** Landing page for the opaque, per-subscriber unsubscribe link sent in campaign emails. */
export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'pending' | 'done' | 'error'>('pending');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Invalid unsubscribe link');
      return;
    }
    unsubscribe(token)
      .then(() => setStatus('done'))
      .catch((err) => {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Could not unsubscribe');
      });
  }, [token]);

  if (status === 'pending') {
    return <p>Unsubscribing…</p>;
  }
  if (status === 'error') {
    return <p className="auth-error">{error}</p>;
  }
  return <p>You&apos;ve been unsubscribed from the newsletter.</p>;
}
