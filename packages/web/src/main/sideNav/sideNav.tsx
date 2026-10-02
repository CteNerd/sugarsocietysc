import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './sideNav.css';

export default function SideNav({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const root = document.getElementById('root');
    const previousOverflow = document.body.style.overflow;
    const previousInert = root?.getAttribute('inert');
    const previousHidden = root?.getAttribute('aria-hidden');
    root?.setAttribute('inert', '');
    root?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
      }
      if (event.key !== 'Tab') return;
      const elements = dialog.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)');
      if (!elements?.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      if (previousInert === null || previousInert === undefined) root?.removeAttribute('inert');
      else root?.setAttribute('inert', previousInert);
      if (previousHidden === null || previousHidden === undefined) root?.removeAttribute('aria-hidden');
      else root?.setAttribute('aria-hidden', previousHidden);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <div className="sidenav-backdrop" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div ref={dialog} id="mobile-navigation" className="sidenav" role="dialog" aria-modal="true" aria-label="Navigation menu">
        <button ref={closeButton} type="button" className="closebtn" onClick={onClose} aria-label="Close navigation menu">
          &times;
        </button>
        <nav aria-label="Mobile navigation">{children}</nav>
      </div>
    </div>,
    document.body,
  );
}
