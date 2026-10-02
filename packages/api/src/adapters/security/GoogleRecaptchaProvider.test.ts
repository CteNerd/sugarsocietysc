import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleRecaptchaError, GoogleRecaptchaProvider } from './GoogleRecaptchaProvider';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GoogleRecaptchaProvider', () => {
  it('returns Google verification results', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal('fetch', fetch);

    await expect(new GoogleRecaptchaProvider('secret-key').verify('token')).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://www.google.com/recaptcha/api/siteverify',
      expect.objectContaining({
        method: 'POST',
        body: new URLSearchParams({ secret: 'secret-key', response: 'token' }),
      }),
    );
  });

  it('fails explicitly when the secret is missing', async () => {
    await expect(new GoogleRecaptchaProvider().verify('token')).rejects.toMatchObject({
      message: 'Google reCAPTCHA verification is not configured',
      statusCode: 503,
    });
  });

  it('reports upstream HTTP failures as unavailable verification', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await expect(new GoogleRecaptchaProvider('secret-key').verify('token')).rejects.toThrow(
      GoogleRecaptchaError,
    );
  });
});
