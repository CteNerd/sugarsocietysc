import { describe, expect, it } from 'vitest';
import { parseGoogleRecaptchaSecret } from './google-recaptcha-secret';

describe('parseGoogleRecaptchaSecret', () => {
  it('reads the secretKey from the AWS Secrets Manager JSON value', () => {
    expect(parseGoogleRecaptchaSecret('{"secretKey":"google-private-key"}')).toBe('google-private-key');
  });

  it('rejects malformed or missing secret values', () => {
    expect(() => parseGoogleRecaptchaSecret('not-json')).toThrow('JSON object containing a secretKey');
    expect(() => parseGoogleRecaptchaSecret('{"secret":"google-private-key"}')).toThrow('non-empty secretKey');
    expect(() => parseGoogleRecaptchaSecret('{"secretKey":"  "}')).toThrow('non-empty secretKey');
  });
});
