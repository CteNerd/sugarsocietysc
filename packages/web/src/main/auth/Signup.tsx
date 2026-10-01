import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

export default function Signup() {
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signUp(form);
      navigate(`/confirm?email=${encodeURIComponent(form.email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-form-container">
      <h1>Create an Account</h1>
      <form onSubmit={handleSubmit}>
        <input placeholder="First name" value={form.firstName} onChange={update('firstName')} required />
        <input placeholder="Last name" value={form.lastName} onChange={update('lastName')} required />
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={update('email')}
          required
        />
        <input
          type="tel"
          placeholder="Phone (e.g. +15555550100)"
          value={form.phone}
          onChange={update('phone')}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={update('password')}
          required
        />
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign Up'}
        </button>
      </form>
      <button type="button" onClick={signInWithGoogle}>
        Continue with Google
      </button>
    </div>
  );
}
