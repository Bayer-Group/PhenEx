// Auth configuration utilities for AuthProvider.
// Provides a typed ApplicationConfig and a getConfig() function reading from Vite env vars.

export interface LoginOptionsConfig {
  msal: boolean;
  password: boolean;
}

export interface MsalConfig {
  auth: {
    clientId: string;
    authority?: string;
  };
  scopes: string[];
}

export interface ApplicationConfig {
  loginOptions: LoginOptionsConfig;
  anon_token: string;
  msal?: MsalConfig;
  i18n?: Record<string, string>;
}

function readBool(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

export function getConfig(): ApplicationConfig {
  const env = (import.meta as any).env || {};

  const loginOptions: LoginOptionsConfig = {
    msal: readBool(env.VITE_AUTH_MSAL, true),
    password: readBool(env.VITE_AUTH_PASSWORD, true),
  };

  const anon_token = env.VITE_ANON_TOKEN || 'anon-user';

  let msal: MsalConfig | undefined;
  if (loginOptions.msal) {
    msal = {
      auth: {
        clientId: env.VITE_MSAL_CLIENT_ID || '',
        authority: env.VITE_MSAL_AUTHORITY || undefined,
      },
      scopes: (env.VITE_MSAL_SCOPES || 'user.read').split(',').map((s: string) => s.trim()),
    };
  }

  const i18n: Record<string, string> = {
    loginTitle: 'Sign in',
    loginWithDev: 'Continue (Dev)',
    loginWithMsal: 'Login with Microsoft',
    email: 'Email',
    password: 'Password',
    login: 'Login',
    register: 'Register',
  };

  return { loginOptions, anon_token, msal, i18n };
}
