import { createContext, PropsWithChildren, useEffect, useRef, useState } from 'react';
import { ApplicationConfig, getConfig } from '../config.ts';
import { MsalProvider } from '@azure/msal-react';
import {
  EventType,
  PublicClientApplication,
  InteractionRequiredAuthError,
  IPublicClientApplication,
} from '@azure/msal-browser';
import jwt_decode from 'jwt-decode';
import { get } from 'lodash';
import { api, registerTokenProvider } from '@/api/httpClient';
import { registerUserProvider, notifyUserChange } from '@/auth/userProviderBridge';

// Local storage utilities for user persistence
const USER_STORAGE_KEY = 'phenex_user_data';
const LOGIN_TYPE_STORAGE_KEY = 'phenex_login_type';
const TOKEN_STORAGE_KEY = 'phenex_auth_token';

const saveUserToStorage = (user: UserData, loginType: LoginType, token?: string) => {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem(LOGIN_TYPE_STORAGE_KEY, loginType);
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
  } catch (error) {
    console.warn('Failed to save user to local storage:', error);
  }
};

const loadUserFromStorage = (): { user: UserData; loginType: LoginType; token?: string } | null => {
  try {
    const userJson = localStorage.getItem(USER_STORAGE_KEY);
    const storedLoginType = localStorage.getItem(LOGIN_TYPE_STORAGE_KEY) as LoginType;
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    
    if (userJson && storedLoginType) {
      const user = JSON.parse(userJson) as UserData;
      return { 
        user, 
        loginType: storedLoginType,
        token: storedToken || undefined
      };
    }
  } catch (error) {
    console.warn('Failed to load user from local storage:', error);
  }
  return null;
};

// Helper function to check if a JWT token is expired
const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwt_decode<any>(token);
    const currentTime = Date.now() / 1000;
    return decoded.exp < currentTime;
  } catch (error) {
    console.warn('Failed to decode token:', error);
    return true; // Treat invalid tokens as expired
  }
};

const clearUserFromStorage = () => {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(LOGIN_TYPE_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear user from local storage:', error);
  }
};

// Auth result shape returned by auth action helpers
export type AuthResult = { success: boolean; error?: string };

export type LoginType = 'anonymous' | 'password' | 'msal';

type AuthContextValue = {
  user: UserData;
  token: string | null;
  loginOptions: {
    password: boolean;
    msal: boolean;
  };
  // New auth action helpers (password & msal)
  loginWithPassword: (email: string, password: string) => Promise<AuthResult>;
  registerWithPassword: (email: string, password: string, username?: string) => Promise<AuthResult>;
  loginWithMsal: () => Promise<AuthResult>;
  logout: () => Promise<void>;
};
export const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export type AuthData = {
  msalInstance: PublicClientApplication | null;
};

export type UserData = {
  username: string;
  email: string;
  isAnonymous: boolean;
};

const _anonymousUser: UserData = {
  username: 'Anonymous',
  email: 'no email',
  isAnonymous: true,
};

export type AuthProviderProps = PropsWithChildren<{}>;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const config = getConfig();

  // Initialize state from local storage if available
  const initializeUserState = () => {
    const stored = loadUserFromStorage();
    if (stored && !stored.user.isAnonymous) {
      // Check if we have a valid token
      if (stored.token && !isTokenExpired(stored.token)) {
        return {
          user: stored.user,
          loginType: stored.loginType,
          token: stored.token
        };
      } else {
        // Token is expired or missing, clear storage and fall back to anonymous
        console.warn('Stored token is expired or missing, falling back to anonymous user');
        clearUserFromStorage();
      }
    }
    return {
      user: _anonymousUser,
      loginType: 'anonymous' as LoginType,
      token: config.anon_token
    };
  };

  const initialState = initializeUserState();

  const [msalInstance, setMsalInstance] = useState<PublicClientApplication | null>(null);
  const [token, setToken] = useState(initialState.token);
  const [user, setUser] = useState<UserData>(initialState.user);
  const [loginType, setLoginType] = useState<LoginType>(initialState.loginType);

  const msalRefreshTimer = useRef<number | null>(null);

  // Clear any scheduled refresh (used on logout / unmount / login type change)
  const clearMsalRefreshTimer = () => {
    if (msalRefreshTimer.current !== null) {
      window.clearTimeout(msalRefreshTimer.current);
      msalRefreshTimer.current = null;
    }
  };

  // Register token provider for api client
  useEffect(() => {
    registerTokenProvider(() => token);
  }, [token]);

  // Register / update global user provider for non-React services
  useEffect(() => {
    registerUserProvider(() => user);
    notifyUserChange();
  }, [user]);

  const processToken = async (token: string, type: LoginType) => {
    const info = jwt_decode<any>(token);
    const userData: UserData = {
      username: info.name || 'User',
      email: info.email || 'no-email',
      isAnonymous: false,
    };
    
    setToken(token);
    setLoginType(type);
    setUser(userData);
    
    // Save user data and token to local storage
    saveUserToStorage(userData, type, token);

    clearMsalRefreshTimer();

    if (type === 'msal' && msalInstance && !!config.msal) {
      // Refresh 2 minutes before actual expiry (minimum 5s from now)
      const expMs = (info?.exp || 5 * 60) * 1000;
      const bufferMs = 2 * 60 * 1000;
      const delay = Math.max(expMs - Date.now() - bufferMs, 5000);
      msalRefreshTimer.current = window.setTimeout(() => {
        getMsalToken(msalInstance, config.msal.scopes).then(token => {
          if (token) processToken(token, 'msal');
        });
      }, delay);
    }
  };

  useEffect(() => {
    async function _getMSAL() {
      const instance = await setupMsalAuth(config, processToken);
      if (instance && !!config.msal) {
        // try to auto-login during init phase
        getMsalToken(instance, config.msal.scopes, true).then(token => {
          if (token) processToken(token, 'msal');
        });
      }
      setMsalInstance(instance);
      console.log('MSAL instance:', instance);
    }
    _getMSAL();
  }, []);

  const loginWithPassword = async (email: string, password: string): Promise<AuthResult> => {
    if (!config.loginOptions.password) return { success: false, error: 'Password auth disabled' };
    try {
      if (!email || !password) return { success: false, error: 'Email and password required' };

      const res = await api.post('/auth/login', { email, password });
      const authToken = (res.data as any)?.auth_token;
      if (!authToken) return { success: false, error: 'Token missing in response' };

      processToken(authToken, 'password');
      return { success: true };
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Login failed';
      console.warn('Password login failed', err);
      return { success: false, error: msg };
    }
  };

  const registerWithPassword = async (
    email: string,
    password: string,
    username?: string
  ): Promise<AuthResult> => {
    if (!config.loginOptions.password) return { success: false, error: 'Registration disabled' };
    try {
      if (!email || !password) return { success: false, error: 'Email and password required' };

      const res = await api.post('/auth/register', { email, password, username });
      if (res.data?.status !== 'success') {
        return { success: false, error: res.data?.message || 'Registration failed' };
      }
      return { success: true };
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Registration failed';
      console.warn('Registration failed', err);
      return { success: false, error: msg };
    }
  };

  const loginWithMsal = async (): Promise<AuthResult> => {
    if (!config.loginOptions.msal || !msalInstance || !config.msal)
      return { success: false, error: 'MSAL auth disabled' };
    try {
      const token = await getMsalToken(msalInstance, config.msal.scopes);
      if (token) {
        await processToken(token, 'msal');
        return { success: true };
      } else {
        return { success: false, error: 'Failed to acquire token' };
      }
    } catch (err: any) {
      return { success: false, error: err?.message || 'MSAL login failed' };
    }
  };

  const logout = async () => {
    try {
      if (loginType === 'msal' && msalInstance) {
        await msalInstance.logoutPopup().catch(() => msalInstance.logoutRedirect());
      }
    } finally {
      clearMsalRefreshTimer();
      clearUserFromStorage();
      setToken(config.anon_token);
      setLoginType('anonymous');
      setUser(_anonymousUser);
    }
  };

  const contextValue: AuthContextValue = {
    user,
    token,
    loginOptions: config.loginOptions,
    loginWithPassword,
    registerWithPassword,
    loginWithMsal,
    logout,
  };

  if (!config.loginOptions.msal || !msalInstance) {
    return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
  }

  return (
    <AuthContext.Provider value={contextValue}>
      <MsalProvider instance={msalInstance}>{children}</MsalProvider>
    </AuthContext.Provider>
  );
};

const setupMsalAuth = async (
  config: ApplicationConfig,
  processToken: (token: string, type: LoginType) => Promise<void>
) => {
  if (!config.loginOptions.msal) return null;
  if (!config.msal) throw new Error('MSAL auth is enabled but config is not given');

  let msalInstance = new PublicClientApplication({
    auth: {
      ...config.msal.auth,
      redirectUri: `${window.location.protocol}//${window.location.host}`,
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false,
    },
  });

  msalInstance.addEventCallback(async (message: any) => {
    if (message.eventType === EventType.LOGIN_SUCCESS) {
      processToken(message.payload.accessToken, 'msal');
    }
  });

  await msalInstance.initialize();

  return msalInstance;
};

const getMsalToken = async (
  instance: IPublicClientApplication,
  scopes: string[],
  silentOnly = false
) => {
  const accounts = instance.getAllAccounts();
  const account = get(accounts, '[0]');

  if (!account && !silentOnly) {
    await instance.acquireTokenPopup({ scopes });
    return '';
  }
  try {
    const result = await instance.acquireTokenSilent({ scopes, account });
    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError && !silentOnly) {
      // fallback to interaction when silent call fails
      await instance.acquireTokenPopup({ scopes });
    }
  }
  return '';
};
