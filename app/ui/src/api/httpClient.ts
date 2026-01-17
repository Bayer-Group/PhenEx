import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Token provider registration (set from AuthProvider at runtime)
// This decouples HTTP layer from any specific auth implementation or framework hooks.
type TokenProvider = () => string | null | undefined;
let tokenProvider: TokenProvider = () => {
  // Return null instead of throwing error - allows unauthenticated requests during initialization
  console.debug('Token provider called before registration - returning null');
  return null;
};
export function registerTokenProvider(provider: TokenProvider) {
  tokenProvider = provider;
}

export const BACKEND_URL: string =
  (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:8000';

// Single axios instance
export const api = axios.create({
  baseURL: BACKEND_URL,
  // You can set a sane default timeout; adjust as needed
  timeout: 60_000,
  withCredentials: false, // set true if backend uses cookie auth
});

// Request interceptor: inject bearer token if available
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    const token = tokenProvider();
    if (token) {
      if (!config.headers) config.headers = {} as any;
      if (!('Authorization' in config.headers)) {
        (config.headers as any)['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (e) {
    console.warn('Token provider failed', e);
  }
  return config;
});

// Optional response interceptor for 401 handling / logging.
api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Potential place for token refresh or forced logout.
      console.warn('Received 401 from API', error.config?.url);
    }
    return Promise.reject(error);
  }
);

// Wrapper for fetch that adds Authorization header (useful for streaming endpoints)
export async function authFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  let token: string | null | undefined = null;
  try {
    token = await tokenProvider();
  } catch (e) {
    console.warn('Token provider failed (fetch)', e);
  }
  const headers = new Headers(init.headers || {});
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

// Helper to build URLs with query params safely
export function buildUrl(path: string, params?: Record<string, any>): string {
  if (!params || Object.keys(params).length === 0) return path;
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    usp.append(k, String(v));
  });
  return `${path}?${usp.toString()}`;
}
