import React, { useEffect, useRef, useState } from 'react';

interface RecaptchaApi {
  ready(callback: () => void): void;
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ): number;
  reset(widgetId?: number): void;
}

declare global {
  interface Window {
    grecaptcha?: RecaptchaApi;
  }
}

interface RecaptchaCheckboxProps {
  onTokenChange: (token: string | null) => void;
}

const SCRIPT_ID = 'google-recaptcha-v2-script';

export default function RecaptchaCheckbox({ onTokenChange }: RecaptchaCheckboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const siteKey = process.env.REACT_APP_RECAPTCHA_SITE_KEY;
    const container = containerRef.current;
    if (!container) return;

    if (!siteKey) {
      setError('The reCAPTCHA site key is not configured.');
      return;
    }

    let disposed = false;
    let widgetId: number | undefined;
    const renderWidget = () => {
      const recaptcha = window.grecaptcha;
      if (!recaptcha) {
        setError('Google reCAPTCHA could not be loaded. Please try again later.');
        return;
      }

      recaptcha.ready(() => {
        if (disposed) return;
        widgetId = recaptcha.render(container, {
          sitekey: siteKey,
          callback: (token) => {
            setError(null);
            onTokenChange(token);
          },
          'expired-callback': () => onTokenChange(null),
          'error-callback': () => {
            onTokenChange(null);
            setError('Google reCAPTCHA could not be verified. Please try again.');
          },
        });
      });
    };

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const onLoad = () => renderWidget();
    const onError = () => setError('Google reCAPTCHA could not be loaded. Please try again later.');
    if (window.grecaptcha) {
      renderWidget();
    } else if (script) {
      script.addEventListener('load', onLoad);
      script.addEventListener('error', onError);
    } else {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.addEventListener('load', onLoad);
      script.addEventListener('error', onError);
      document.head.appendChild(script);
    }

    return () => {
      disposed = true;
      script?.removeEventListener('load', onLoad);
      script?.removeEventListener('error', onError);
      if (widgetId !== undefined) {
        window.grecaptcha?.reset(widgetId);
      }
    };
  }, [onTokenChange]);

  return (
    <div className="recaptcha-field">
      <div ref={containerRef} />
      {error && <p className="contact-error" role="alert">{error}</p>}
    </div>
  );
}
