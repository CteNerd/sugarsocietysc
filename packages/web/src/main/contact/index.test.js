import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import Contact from './index';
import { submitContact } from '../../api/contact-client';

jest.mock('../../api/contact-client', () => ({ submitContact: jest.fn() }));
jest.mock('../../components/RecaptchaCheckbox', () => ({
  __esModule: true,
  default: ({ onTokenChange }) => (
    <button type="button" onClick={() => onTokenChange('verified-token')}>Complete reCAPTCHA</button>
  ),
}));

let container;
let root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  submitContact.mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.clearAllMocks();
});

test('submits the contact fields with a verified CAPTCHA and confirms success', async () => {
  act(() => root.render(<MemoryRouter><Contact /></MemoryRouter>));

  for (const [name, value] of [
    ['firstName', 'Jamie'],
    ['lastName', 'Baker'],
    ['email', 'jamie@example.com'],
    ['subject', 'Custom cookies'],
  ]) {
    act(() => Simulate.change(container.querySelector(`[name="${name}"]`), { target: { value } }));
  }
  act(() => Simulate.click(container.querySelector('button[type="button"]')));
  await act(async () => {
    Simulate.submit(container.querySelector('form'));
  });

  expect(submitContact).toHaveBeenCalledWith({
    firstName: 'Jamie',
    lastName: 'Baker',
    email: 'jamie@example.com',
    phone: '',
    subject: 'Custom cookies',
    message: '',
    recaptchaToken: 'verified-token',
  });
  expect(container.textContent).toContain('Your message has been sent.');
});
