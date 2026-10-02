import { IHumanVerificationProvider } from '../../ports/contact/IHumanVerificationProvider';

export class GoogleRecaptchaError extends Error {
  constructor(message: string, public readonly statusCode: 502 | 503) {
    super(message);
  }
}

export class GoogleRecaptchaProvider implements IHumanVerificationProvider {
  constructor(private readonly secret?: string) {}

  async verify(token: string): Promise<boolean> {
    if (!this.secret) {
      throw new GoogleRecaptchaError('Google reCAPTCHA verification is not configured', 503);
    }

    let response: Response;
    try {
      response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: this.secret, response: token }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new GoogleRecaptchaError('Google reCAPTCHA verification is unavailable', 502);
    }

    if (!response.ok) {
      throw new GoogleRecaptchaError('Google reCAPTCHA verification is unavailable', 502);
    }

    const result = await response.json().catch(() => null) as { success?: boolean } | null;
    if (!result) {
      throw new GoogleRecaptchaError('Google reCAPTCHA verification is unavailable', 502);
    }
    return result.success === true;
  }
}
