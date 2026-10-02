import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import Navigation from './Navigation';
import { useAuth } from '../auth/AuthContext';

jest.mock('../auth/AuthContext', () => ({ useAuth: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;
let container;
let root;
const admin = { role: 'admin', isActive: true };
const defaults = {
  idToken: null, loading: false, user: null, profileLoading: false,
  profileError: null, signOut: jest.fn(),
};
beforeEach(() => {
  container = document.createElement('div');
  container.id = 'root';
  document.body.append(container);
  root = createRoot(container);
  useAuth.mockReturnValue(defaults);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

function render(mobile, auth = defaults) {
  useAuth.mockReturnValue(auth);
  act(() => root.render(<MemoryRouter><Navigation isMobile={mobile} /></MemoryRouter>));
  if (mobile) {
    act(() => Simulate.click(container.querySelector('.menu-btn')));
    return document.querySelector('.sidenav');
  }
  return container;
}

test.each([false, true])('exposes all public and guest destinations (mobile=%s)', (mobile) => {
  const nav = render(mobile);
  const links = [...nav.querySelectorAll('a')].map((a) => a.getAttribute('href'));
  for (const to of ['/', '/our-story', '/specials', '/our-cookies', '/order-now', '/pre-sale', '/contact', '/login', '/signup']) {
    expect(links).toContain(to);
  }
  expect(links).not.toContain('/admin');
});

test.each([false, true])('exposes customer account/order/logout without admin tools (mobile=%s)', (mobile) => {
  const nav = render(mobile, { ...defaults, idToken: 'customer', user: { role: 'customer', isActive: true } });
  expect(nav.querySelector('a[href="/account"]')).not.toBeNull();
  expect(nav.querySelector('a[href="/orders"]')).not.toBeNull();
  expect(nav.querySelector('a[href="/login"]')).toBeNull();
  expect(nav.textContent).toContain('Log Out');
  expect(nav.querySelector('a[href="/admin"]')).toBeNull();
});

test.each([false, true])('exposes each admin destination (mobile=%s)', (mobile) => {
  const nav = render(mobile, { ...defaults, idToken: 'admin', user: admin });
  for (const to of ['/admin', '/admin#presale', '/admin#packaging', '/admin#orders', '/admin#newsletter']) {
    expect(nav.querySelector(`a[href="${to}"]`)).not.toBeNull();
  }
});

test.each([false, true])('keeps My Orders available regardless of profile eligibility (mobile=%s)', (mobile) => {
  for (const overrides of [
    { user: null, profileLoading: true },
    { user: null, profileError: 'Network failure' },
    { user: null },
    { user: { ...admin, isActive: false } },
  ]) {
    const nav = render(mobile, { ...defaults, idToken: 'token', ...overrides });
    expect(nav.querySelector('a[href="/orders"]')).not.toBeNull();
    expect(nav.querySelector('a[href="/admin"]')).toBeNull();
    if (mobile) act(() => Simulate.click(nav.querySelector('.closebtn')));
  }
});

test.each([
  { loading: true }, { profileLoading: true }, { profileError: 'Network failure' },
  { user: { ...admin, isActive: false } },
])('does not expose admin links with unresolved or denied eligibility: %j', (overrides) => {
  const nav = render(false, { ...defaults, idToken: 'token', user: admin, ...overrides });
  expect(nav.querySelector('a[href="/admin"]')).toBeNull();
});

test('traps focus, makes the background inert, and restores focus/scroll on Escape', () => {
  render(false);
  act(() => root.render(<MemoryRouter><Navigation isMobile /></MemoryRouter>));
  const trigger = container.querySelector('.menu-btn');
  trigger.focus();
  act(() => Simulate.click(trigger));
  const close = document.querySelector('.closebtn');
  const links = document.querySelectorAll('.sidenav a');
  expect(document.activeElement).toBe(close);
  expect(container.hasAttribute('inert')).toBe(true);
  expect(document.body.style.overflow).toBe('hidden');
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })));
  expect(document.activeElement).toBe(links[links.length - 1]);
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
  expect(document.activeElement).toBe(close);
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(document.querySelector('.sidenav')).toBeNull();
  expect(container.hasAttribute('inert')).toBe(false);
  expect(document.body.style.overflow).toBe('');
  expect(document.activeElement).toBe(trigger);
});

test('closes on backdrop, navigation, and breakpoint changes', () => {
  let nav = render(true);
  act(() => Simulate.click(document.querySelector('.sidenav-backdrop')));
  expect(document.querySelector('.sidenav')).toBeNull();
  nav = render(true);
  act(() => Simulate.click(nav.querySelector('a[href="/pre-sale"]')));
  expect(document.querySelector('.sidenav')).toBeNull();
  render(true);
  act(() => root.render(<MemoryRouter><Navigation isMobile={false} /></MemoryRouter>));
  expect(document.querySelector('.sidenav')).toBeNull();
});
