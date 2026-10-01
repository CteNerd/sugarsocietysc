import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribe } from '../api/newsletter-client';

/** Guest-facing newsletter signup widget (footer). After a successful subscribe, offers an optional
 * account-creation upsell — full membership unlocks order history and faster checkout. */
export default function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await subscribe({ email, emailOptIn: true, smsOptIn: false, source: 'footer' });
      setSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscription failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (subscribed) {
    return (
      <div className="newsletter-signup">
        <p>You&apos;re on the list! 🍪</p>
        <p>
          Want order history and faster checkout too? <Link to="/signup">Create an account</Link>.
        </p>
      </div>
    );
  }

  return (
    <form className="newsletter-signup" onSubmit={handleSubmit}>
      <label htmlFor="newsletter-email">Get holiday drops &amp; specials in your inbox</label>
      <input
        id="newsletter-email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Subscribing…' : 'Subscribe'}
      </button>
      {error && <p className="auth-error">{error}</p>}
    </form>
  );
}
