import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from './AuthContext';
import { AuthApiError, getCurrentUser, syncProfile } from '../api/auth-client';
import { userPool } from './cognito-config';
import { CognitoUser } from 'amazon-cognito-identity-js';

jest.mock('../api/auth-client', () => ({
  ...jest.requireActual('../api/auth-client'),
  getCurrentUser: jest.fn(),
  syncProfile: jest.fn(),
}));
jest.mock('./cognito-config', () => ({
  userPool: { getCurrentUser: jest.fn(), getClientId: () => 'client' },
  hostedUiDomain: 'https://auth.example.test',
  oauthRedirectUri: 'http://localhost/auth/callback',
}));
jest.mock('amazon-cognito-identity-js', () => ({
  CognitoUser: jest.fn(),
  CognitoUserAttribute: jest.fn(),
  AuthenticationDetails: jest.fn(),
}));

let container;
let root;
let auth;
const originalFetch = global.fetch;
const user = { id: 'user', role: 'admin', isActive: true, phone: '+15555550123' };
function Probe() {
  auth = useAuth();
  return <span>{auth.user?.role ?? 'no profile'}</span>;
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function storeSession(overrides = {}) {
  sessionStorage.setItem('google_oauth_session', JSON.stringify({
    idToken: 'restored-token', accessToken: 'access', refreshToken: 'refresh',
    expiresAt: Date.now() + 3600000, ...overrides,
  }));
}
async function mount() {
  await act(async () => { root.render(<AuthProvider><Probe /></AuthProvider>); });
}
function tokenFor(name) {
  return `header.${btoa(JSON.stringify({ email: `${name}@example.test`, given_name: name, family_name: 'Test' }))}.signature`;
}
function tokenResponse(idToken) {
  return { ok: true, json: async () => ({ id_token: idToken, access_token: 'access', expires_in: 3600 }) };
}

beforeEach(() => {
  jest.resetAllMocks();
  sessionStorage.clear();
  userPool.getCurrentUser.mockReturnValue(null);
  getCurrentUser.mockResolvedValue(user);
  global.fetch = jest.fn();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  sessionStorage.clear();
  global.fetch = originalFetch;
  jest.useRealTimers();
});

test('restores Google sessions and waits for an authoritative role', async () => {
  storeSession();
  const pending = deferred();
  getCurrentUser.mockReturnValue(pending.promise);
  await mount();
  expect(auth.profileLoading).toBe(true);
  expect(auth.user).toBeNull();
  await act(async () => pending.resolve(user));
  expect(auth.user).toEqual(user);
  expect(auth.profileLoading).toBe(false);
  expect(getCurrentUser).toHaveBeenCalledTimes(1);
});

test('restores Cognito sessions through the same shared profile lookup', async () => {
  userPool.getCurrentUser.mockReturnValue({
    getSession: (callback) => callback(null, { getIdToken: () => ({ getJwtToken: () => 'password-token' }) }),
  });
  await mount();
  expect(getCurrentUser).toHaveBeenCalledWith('password-token');
  expect(auth.user).toEqual(user);
});

test('waits for password profile synchronization before publishing the session', async () => {
  const pending = deferred();
  syncProfile.mockReturnValue(pending.promise);
  CognitoUser.mockImplementation(() => ({
    authenticateUser: (_details, callbacks) => callbacks.onSuccess({
      getIdToken: () => ({ getJwtToken: () => 'password-token' }),
    }),
    getUserAttributes: (callback) => callback(null, [
      { getName: () => 'given_name', getValue: () => 'Test' },
      { getName: () => 'family_name', getValue: () => 'Customer' },
      { getName: () => 'phone_number', getValue: () => '+15555550123' },
    ]),
  }));
  await mount();
  let signIn;
  act(() => { signIn = auth.signIn('customer@example.test', 'test-password'); });
  expect(auth.idToken).toBeNull();
  expect(getCurrentUser).not.toHaveBeenCalled();
  await act(async () => { pending.resolve({ ...user, role: 'customer' }); await signIn; });
  expect(auth.idToken).toBe('password-token');
  expect(auth.user.role).toBe('customer');
  expect(auth.profileLoading).toBe(false);
  expect(getCurrentUser).not.toHaveBeenCalled();
});

test('distinguishes expected missing profiles from failures and supports retry', async () => {
  storeSession();
  getCurrentUser.mockRejectedValueOnce(new Error('Service unavailable'));
  await mount();
  expect(auth.profileError).toBe('Service unavailable');
  expect(auth.user).toBeNull();
  getCurrentUser.mockRejectedValueOnce(new AuthApiError('User not yet synced', 404));
  await act(async () => auth.refreshProfile());
  expect(auth.profileError).toBeNull();
  expect(auth.profileLoading).toBe(false);
  expect(auth.user).toBeNull();
  await act(async () => auth.refreshProfile());
  expect(auth.user).toEqual(user);
});

test('ignores a delayed profile response after logout', async () => {
  storeSession();
  const pending = deferred();
  getCurrentUser.mockReturnValue(pending.promise);
  await mount();
  act(() => auth.signOut());
  await act(async () => pending.resolve(user));
  expect(auth.idToken).toBeNull();
  expect(auth.user).toBeNull();
  expect(auth.profileLoading).toBe(false);
});

test('synchronizes a new Google profile into shared state', async () => {
  getCurrentUser.mockRejectedValue(new AuthApiError('User not yet synced', 404));
  await mount();
  const token = tokenFor('new');
  global.fetch.mockResolvedValue(tokenResponse(token));
  await act(async () => auth.exchangeGoogleCode('code'));
  expect(auth.user).toBeNull();
  syncProfile.mockResolvedValue(user);
  const input = { firstName: 'New', lastName: 'Customer', phone: '+15555550123' };
  await act(async () => auth.syncUserProfile(input));
  expect(syncProfile).toHaveBeenCalledWith(token, input);
  expect(auth.user).toEqual(user);
});

test('does not reuse the previous role or error when switching identities', async () => {
  storeSession();
  await mount();
  expect(auth.user.role).toBe('admin');
  const pending = deferred();
  getCurrentUser.mockReturnValue(pending.promise);
  global.fetch.mockResolvedValue(tokenResponse(tokenFor('customer')));
  await act(async () => auth.exchangeGoogleCode('code'));
  expect(auth.profileLoading).toBe(true);
  expect(auth.user).toBeNull();
  expect(auth.profileError).toBeNull();
  await act(async () => pending.resolve({ ...user, role: 'customer' }));
  expect(auth.user.role).toBe('customer');
});

test('ignores the previous identity response after a new identity finishes loading', async () => {
  storeSession();
  const previous = deferred();
  const current = deferred();
  getCurrentUser.mockReturnValueOnce(previous.promise).mockReturnValueOnce(current.promise);
  await mount();
  global.fetch.mockResolvedValue(tokenResponse(tokenFor('customer')));
  await act(async () => auth.exchangeGoogleCode('code'));
  await act(async () => current.resolve({ ...user, role: 'customer' }));
  await act(async () => previous.resolve(user));
  expect(auth.user.role).toBe('customer');
});

test('refreshes shared roles when Google tokens refresh', async () => {
  jest.useFakeTimers();
  storeSession({ expiresAt: Date.now() + 61000 });
  await mount();
  getCurrentUser.mockResolvedValue({ ...user, role: 'customer' });
  global.fetch.mockResolvedValue(tokenResponse('refreshed-token'));
  await act(async () => jest.advanceTimersByTime(30000));
  expect(auth.idToken).toBe('refreshed-token');
  expect(getCurrentUser).toHaveBeenLastCalledWith('refreshed-token');
  expect(auth.user.role).toBe('customer');
});

test('does not restore a session when an in-flight refresh finishes after logout', async () => {
  jest.useFakeTimers();
  storeSession({ expiresAt: Date.now() + 61000 });
  await mount();
  const pending = deferred();
  global.fetch.mockReturnValue(pending.promise);
  await act(async () => jest.advanceTimersByTime(30000));
  act(() => auth.signOut());
  await act(async () => pending.resolve(tokenResponse('late-token')));
  expect(auth.idToken).toBeNull();
  expect(auth.user).toBeNull();
  expect(sessionStorage.getItem('google_oauth_session')).toBeNull();
});
