import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';
import { hostedUiDomain, oauthRedirectUri, userPool } from './cognito-config';
import { generateCodeChallenge, generateCodeVerifier } from './pkce';
import { syncProfile } from '../api/auth-client';

export interface SignUpInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface GoogleTokenClaims {
  email: string;
  firstName: string;
  lastName: string;
}

interface AuthContextValue {
  idToken: string | null;
  loading: boolean;
  signUp: (input: SignUpInput) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  resendConfirmationCode: (email: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  exchangeGoogleCode: (code: string) => Promise<{ idToken: string; claims: GoogleTokenClaims }>;
  signOut: () => void;
}

const PKCE_VERIFIER_STORAGE_KEY = 'google_oauth_pkce_verifier';
const GOOGLE_SESSION_STORAGE_KEY = 'google_oauth_session';

interface GoogleOAuthSession {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

interface GoogleOAuthTokenResponse {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function refreshGoogleSession(session: GoogleOAuthSession): Promise<GoogleOAuthSession> {
  if (!session.refreshToken) {
    throw new Error('Google sign-in session expired; sign in again');
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: userPool.getClientId(),
    refresh_token: session.refreshToken,
  });
  const response = await fetch(`${hostedUiDomain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new Error('Could not refresh Google sign-in session');
  }
  const tokens = await response.json() as Partial<GoogleOAuthTokenResponse>;
  if (!tokens.id_token || !tokens.access_token || !tokens.expires_in) {
    throw new Error('Google sign-in refresh returned an invalid token response');
  }
  return {
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? session.refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
}

function decodeIdTokenClaims(idToken: string): GoogleTokenClaims {
  const payload = JSON.parse(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  return {
    email: payload.email ?? '',
    firstName: payload.given_name ?? '',
    lastName: payload.family_name ?? '',
  };
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getAttribute(attributes: CognitoUserAttribute[], name: string): string {
  return attributes.find((a) => a.getName() === name)?.getValue() ?? '';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [idToken, setIdToken] = useState<string | null>(null);
  const [googleSession, setGoogleSession] = useState<GoogleOAuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const storedSession = sessionStorage.getItem(GOOGLE_SESSION_STORAGE_KEY);
    if (storedSession) {
      void (async () => {
        try {
          let session = JSON.parse(storedSession) as GoogleOAuthSession;
          if (!session.idToken || !session.accessToken || !Number.isFinite(session.expiresAt)) {
            throw new Error('Stored Google session is invalid');
          }
          if (session.expiresAt <= Date.now() + 60_000) {
            session = await refreshGoogleSession(session);
          }
          if (active) {
            sessionStorage.setItem(GOOGLE_SESSION_STORAGE_KEY, JSON.stringify(session));
            setGoogleSession(session);
            setIdToken(session.idToken);
          }
        } catch (err) {
          sessionStorage.removeItem(GOOGLE_SESSION_STORAGE_KEY);
          console.error('Could not restore Google sign-in session', err);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }

    const currentUser = userPool.getCurrentUser();
    if (!currentUser) {
      setLoading(false);
      return () => { active = false; };
    }
    currentUser.getSession((err: Error | null, session: { getIdToken(): { getJwtToken(): string } } | null) => {
      if (active && !err && session) {
        setIdToken(session.getIdToken().getJwtToken());
      }
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!googleSession) return undefined;
    const refreshIfNeeded = async () => {
      if (googleSession.expiresAt > Date.now() + 60_000) return;
      try {
        const refreshed = await refreshGoogleSession(googleSession);
        sessionStorage.setItem(GOOGLE_SESSION_STORAGE_KEY, JSON.stringify(refreshed));
        setGoogleSession(refreshed);
        setIdToken(refreshed.idToken);
      } catch (err) {
        console.error('Could not refresh Google sign-in session', err);
        sessionStorage.removeItem(GOOGLE_SESSION_STORAGE_KEY);
        setGoogleSession(null);
        setIdToken(null);
      }
    };
    const timer = window.setInterval(() => { void refreshIfNeeded(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [googleSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      idToken,
      loading,
      signUp: ({ email, password, firstName, lastName, phone }) =>
        new Promise((resolve, reject) => {
          const attributes = [
            new CognitoUserAttribute({ Name: 'email', Value: email }),
            new CognitoUserAttribute({ Name: 'given_name', Value: firstName }),
            new CognitoUserAttribute({ Name: 'family_name', Value: lastName }),
            new CognitoUserAttribute({ Name: 'phone_number', Value: phone }),
          ];
          userPool.signUp(email, password, attributes, [], (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        }),

      confirmSignUp: (email, code) =>
        new Promise((resolve, reject) => {
          const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
          cognitoUser.confirmRegistration(code, true, (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        }),

      resendConfirmationCode: (email) =>
        new Promise((resolve, reject) => {
          const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
          cognitoUser.resendConfirmationCode((err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        }),

      signIn: (email, password) =>
        new Promise((resolve, reject) => {
          const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
          const authDetails = new AuthenticationDetails({ Username: email, Password: password });
          cognitoUser.authenticateUser(authDetails, {
            onSuccess: async (session) => {
              const token = session.getIdToken().getJwtToken();
              setIdToken(token);
              sessionStorage.removeItem(GOOGLE_SESSION_STORAGE_KEY);
              setGoogleSession(null);
              try {
                cognitoUser.getUserAttributes((attrErr, attributes) => {
                  if (attrErr || !attributes) {
                    resolve();
                    return;
                  }
                  syncProfile(token, {
                    firstName: getAttribute(attributes, 'given_name'),
                    lastName: getAttribute(attributes, 'family_name'),
                    phone: getAttribute(attributes, 'phone_number'),
                  }).then(() => resolve()).catch(reject);
                });
              } catch (err) {
                reject(err);
              }
            },
            onFailure: (err) => reject(err),
          });
        }),

      signInWithGoogle: async () => {
        const verifier = generateCodeVerifier();
        sessionStorage.setItem(PKCE_VERIFIER_STORAGE_KEY, verifier);
        const challenge = await generateCodeChallenge(verifier);
        const params = new URLSearchParams({
          identity_provider: 'Google',
          redirect_uri: oauthRedirectUri,
          response_type: 'code',
          client_id: userPool.getClientId(),
          scope: 'openid email profile',
          code_challenge_method: 'S256',
          code_challenge: challenge,
        });
        window.location.assign(`${hostedUiDomain}/oauth2/authorize?${params.toString()}`);
      },

      exchangeGoogleCode: async (code) => {
        const verifier = sessionStorage.getItem(PKCE_VERIFIER_STORAGE_KEY) ?? '';
        sessionStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
        const body = new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: userPool.getClientId(),
          code,
          redirect_uri: oauthRedirectUri,
          code_verifier: verifier,
        });
        const res = await fetch(`${hostedUiDomain}/oauth2/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
        if (!res.ok) {
          throw new Error('Google sign-in failed');
        }
        const tokens = await res.json() as Partial<GoogleOAuthTokenResponse>;
        if (!tokens.id_token || !tokens.access_token || !tokens.expires_in) {
          throw new Error('Google sign-in returned an invalid token response');
        }
        const session: GoogleOAuthSession = {
          idToken: tokens.id_token,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: Date.now() + tokens.expires_in * 1000,
        };
        sessionStorage.setItem(GOOGLE_SESSION_STORAGE_KEY, JSON.stringify(session));
        setGoogleSession(session);
        setIdToken(session.idToken);
        return { idToken: session.idToken, claims: decodeIdTokenClaims(session.idToken) };
      },

      signOut: () => {
        userPool.getCurrentUser()?.signOut();
        sessionStorage.removeItem(GOOGLE_SESSION_STORAGE_KEY);
        setGoogleSession(null);
        setIdToken(null);
      },
    }),
    [idToken, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
