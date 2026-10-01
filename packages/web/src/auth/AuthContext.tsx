import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';
import { userPool } from './cognito-config';
import { syncProfile } from '../api/auth-client';

export interface SignUpInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface AuthContextValue {
  idToken: string | null;
  loading: boolean;
  signUp: (input: SignUpInput) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  resendConfirmationCode: (email: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getAttribute(attributes: CognitoUserAttribute[], name: string): string {
  return attributes.find((a) => a.getName() === name)?.getValue() ?? '';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = userPool.getCurrentUser();
    if (!currentUser) {
      setLoading(false);
      return;
    }
    currentUser.getSession((err: Error | null, session: { getIdToken(): { getJwtToken(): string } } | null) => {
      if (!err && session) {
        setIdToken(session.getIdToken().getJwtToken());
      }
      setLoading(false);
    });
  }, []);

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
              try {
                cognitoUser.getUserAttributes(async (attrErr, attributes) => {
                  if (!attrErr && attributes) {
                    await syncProfile(token, {
                      firstName: getAttribute(attributes, 'given_name'),
                      lastName: getAttribute(attributes, 'family_name'),
                      phone: getAttribute(attributes, 'phone_number'),
                    });
                  }
                  resolve();
                });
              } catch {
                resolve();
              }
            },
            onFailure: (err) => reject(err),
          });
        }),

      signOut: () => {
        userPool.getCurrentUser()?.signOut();
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
