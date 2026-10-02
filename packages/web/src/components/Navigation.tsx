import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import SideNav from '../main/sideNav/sideNav';

const publicLinks = [
  { to: '/', label: 'Home' },
  { to: '/our-story', label: 'Our Story' },
  { to: '/specials', label: 'Specials' },
  { to: '/our-cookies', label: 'Our Cookies' },
  { to: '/order-now', label: 'Order Now' },
  { to: '/pre-sale', label: 'Pre-Sale' },
  { to: '/contact', label: 'Contact' },
];

const adminLinks = [
  { to: '/admin', label: 'Dashboard' },
  { to: '/admin#presale', label: 'Pre-Sale & Menus' },
  { to: '/admin#packaging', label: 'Packaging' },
  { to: '/admin#orders', label: 'Orders' },
  { to: '/admin#newsletter', label: 'Newsletter' },
];

function NavigationLink({ to, label, onNavigate }: { to: string; label: string; onNavigate: () => void }) {
  const location = useLocation();
  const active = to === `${location.pathname}${location.hash}` ||
    (to === '/pre-sale' && location.pathname.startsWith('/presale/'));
  return <Link to={to} aria-current={active ? 'page' : undefined} onClick={onNavigate}>{label}</Link>;
}

function NavigationLinks({ mobile, onNavigate }: { mobile: boolean; onNavigate: () => void }) {
  const adminMenu = useRef<HTMLDetailsElement>(null);
  const { idToken, loading, user, profileLoading, profileError, signOut } = useAuth();
  const isAdmin = !loading && !profileLoading && !profileError && user?.isActive && user.role === 'admin';
  const accountLinks = idToken
    ? [{ to: '/account', label: 'Account' }, { to: '/orders', label: 'My Orders' }]
    : [{ to: '/login', label: 'Log In' }, { to: '/signup', label: 'Sign Up' }];
  const renderAdminLinks = () => adminLinks.map((link) => (
    <NavigationLink key={link.to} {...link} onNavigate={() => {
      if (adminMenu.current) adminMenu.current.open = false;
      onNavigate();
    }} />
  ));

  return (
    <>
      <div className="nav-public-links">
        {publicLinks.map((link) => <NavigationLink key={link.to} {...link} onNavigate={onNavigate} />)}
      </div>
      <div className="nav-account-links">
        {!loading && accountLinks.map((link) => <NavigationLink key={link.to} {...link} onNavigate={onNavigate} />)}
        {idToken && <button type="button" onClick={() => { signOut(); onNavigate(); }}>Log Out</button>}
        {profileError && <Link to="/account" onClick={onNavigate}>Account needs attention</Link>}
      </div>
      {isAdmin && (mobile ? (
        <div className="nav-admin-group">
          <h2>Administration</h2>
          {renderAdminLinks()}
        </div>
      ) : (
        <details ref={adminMenu} className="nav-admin-dropdown">
          <summary>Administration</summary>
          <div className="nav-admin-links">{renderAdminLinks()}</div>
        </details>
      ))}
    </>
  );
}

export default function Navigation({ isMobile }: { isMobile: boolean }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { idToken } = useAuth();
  useEffect(() => { setOpen(false); }, [location.pathname, location.hash, isMobile, idToken]);
  const close = () => setOpen(false);

  return (
    <>
      <nav className={isMobile ? 'mobile-nav-bar' : 'main-nav'} aria-label="Primary navigation">
        <Link to="/" className="nav-logo-link" aria-label="Sugar Society home">
          <img
            className="nav-logo"
            src="https://wellcall-app-cdk.s3.amazonaws.com/sugar-society/photos/sugar-society-sugar-cookies.png"
            alt="Sugar Society Sugar Cookies Logo"
          />
        </Link>
        {isMobile ? (
          <button
            type="button"
            className="menu-btn"
            aria-label="Open navigation menu"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen(true)}
          >
            <span className="menu-line" />
            <span className="menu-line" />
            <span className="menu-line" />
          </button>
        ) : <NavigationLinks mobile={false} onNavigate={close} />}
      </nav>
      {isMobile && open && <SideNav onClose={close}><NavigationLinks mobile onNavigate={close} /></SideNav>}
    </>
  );
}
