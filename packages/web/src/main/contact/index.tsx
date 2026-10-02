import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { submitContact } from '../../api/contact-client';
import RecaptchaCheckbox from '../../components/RecaptchaCheckbox';
import './contact.css';

interface ContactFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

const emptyForm: ContactFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
};

export default function Contact() {
  const [form, setForm] = useState(emptyForm);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [captchaGeneration, setCaptchaGeneration] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(field: keyof ContactFormValues, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!recaptchaToken) {
      setError('Please complete the reCAPTCHA check before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await submitContact({ ...form, recaptchaToken });
      setSubmitted(true);
      setForm(emptyForm);
      setRecaptchaToken(null);
      setCaptchaGeneration((generation) => generation + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your message could not be sent. Please try again.');
      setRecaptchaToken(null);
      setCaptchaGeneration((generation) => generation + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="contact-page">
      <header className="contact-intro">
        <h1>Contact Us Anytime</h1>
        <p>
          Thank you for reaching out about an order. We are in Rosharon, Texas, and serve the greater
          Houston area for local pickup or delivery. For pricing or cookie designs not featured on our
          website, send us a message below. If you are ready to place an order, visit the{' '}
          <Link to="/order-now">Order Now</Link> page.
        </p>
      </header>

      {submitted ? (
        <div className="contact-success" role="status">
          <h2>Thank you for contacting us!</h2>
          <p>Your message has been sent. We will be in touch as soon as we can.</p>
          <button type="button" onClick={() => setSubmitted(false)}>Send another message</button>
        </div>
      ) : (
        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="contact-form-grid">
            <label>
              <span className="contact-label-text">
                First Name <span aria-hidden="true">*</span>
              </span>
              <input
                autoComplete="given-name"
                name="firstName"
                value={form.firstName}
                onChange={(event) => updateField('firstName', event.target.value)}
                required
              />
            </label>
            <label>
              <span className="contact-label-text">
                Last Name <span aria-hidden="true">*</span>
              </span>
              <input
                autoComplete="family-name"
                name="lastName"
                value={form.lastName}
                onChange={(event) => updateField('lastName', event.target.value)}
                required
              />
            </label>
            <label>
              <span className="contact-label-text">
                Email <span aria-hidden="true">*</span>
              </span>
              <input
                autoComplete="email"
                name="email"
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                required
              />
            </label>
            <label>
              <span className="contact-label-text">Phone Number</span>
              <input
                autoComplete="tel"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={(event) => updateField('phone', event.target.value)}
              />
            </label>
            <label>
              <span className="contact-label-text">
                Subject <span aria-hidden="true">*</span>
              </span>
              <input
                name="subject"
                value={form.subject}
                onChange={(event) => updateField('subject', event.target.value)}
                required
              />
            </label>
            <label>
              <span className="contact-label-text">More Information</span>
              <textarea
                name="message"
                rows={5}
                value={form.message}
                onChange={(event) => updateField('message', event.target.value)}
              />
            </label>
          </div>
          <RecaptchaCheckbox key={captchaGeneration} onTokenChange={setRecaptchaToken} />
          {error && <p className="contact-error" role="alert">{error}</p>}
          <button className="contact-submit" type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Submit'}
          </button>
          <p className="contact-retention-note">
            We keep contact-form messages for up to one year so we can respond and follow up.
          </p>
        </form>
      )}
    </section>
  );
}
