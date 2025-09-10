// Global user provider bridge (framework-agnostic)
// Allows non-React modules/services to access current authenticated user info
// without importing React or using hooks.

import type { UserData } from '@/auth/AuthProvider';

export type UserProvider = () => UserData | null;

let currentProvider: UserProvider = () => null;
let listeners: Array<() => void> = [];

export function registerUserProvider(provider: UserProvider) {
  currentProvider = provider;
  notify();
}

export function getCurrentUser(): UserData | null {
  try {
    return currentProvider();
  } catch {
    return null;
  }
}

export function onUserChange(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

export function notifyUserChange() {
  notify();
}

function notify() {
  listeners.forEach(l => {
    try {
      l();
    } catch (e) {
      console.warn('userProviderBridge listener failed', e);
    }
  });
}
