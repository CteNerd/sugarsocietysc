import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminProtectedRoute from './AdminProtectedRoute';
import { useAuth } from './AuthContext';

jest.mock('./AuthContext', () => ({ useAuth: jest.fn() }));
let container;
let root;
const defaults = {
  idToken: 'token', loading: false, user: { role: 'admin', isActive: true },
  profileLoading: false, profileError: null, refreshProfile: jest.fn(),
};
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

function render(overrides = {}) {
  useAuth.mockReturnValue({ ...defaults, ...overrides });
  act(() => root.render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminProtectedRoute><h1>Admin tools</h1></AdminProtectedRoute>} />
        <Route path="/login" element={<h1>Log In</h1>} />
        <Route path="/account" element={<h1>Account setup</h1>} />
      </Routes>
    </MemoryRouter>,
  ));
}

test('shows authorized tools only after profile verification', () => {
  render({ profileLoading: true });
  expect(container.textContent).not.toContain('Admin tools');
  expect(container.textContent).not.toContain('do not have');
  render();
  expect(container.textContent).toContain('Admin tools');
});

test.each([{ role: 'customer', isActive: true }, { role: 'admin', isActive: false }])(
  'denies unauthorized or inactive accounts: %j', (user) => {
    render({ user });
    expect(container.textContent).toContain('You do not have administrator access');
    expect(container.textContent).not.toContain('Admin tools');
  },
);

test('shows recoverable verification errors, not a false access denial', () => {
  render({ profileError: 'Connection failed' });
  expect(container.textContent).toContain('Could not verify administrator access');
  expect(container.textContent).not.toContain('You do not have');
  act(() => Simulate.click(container.querySelector('button')));
  expect(defaults.refreshProfile).toHaveBeenCalled();
});

test('redirects guests to login and missing profiles to account setup', () => {
  render({ idToken: null, user: null });
  expect(container.textContent).toBe('Log In');
  act(() => root.unmount());
  root = createRoot(container);
  render({ user: null });
  expect(container.textContent).toBe('Account setup');
});
