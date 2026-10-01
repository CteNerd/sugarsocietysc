import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

export default function Confirm() {
  const { confirmSignUp, resendConfirmationCode } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await confirmSignUp(email, code);
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setMessage(null);
    try {
      await resendConfirmationCode(email);
      setMessage('A new code has been sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code');
    }
  }

  return (
    <div className="auth-form-container">
      <h1>Confirm Your Account</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          placeholder="Confirmation code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-message">{message}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Confirming…' : 'Confirm'}
        </button>
      </form>
      <button type="button" onClick={handleResend}>
        Resend code
      </button>
    </div>
  );
}
