'use client';

import { useLocalStorageValue, writeLocalStorage } from './useLocalStorage';

export const USERNAME_KEY = 'sleeper_username';

export function useSavedUsername(): string | null {
  return useLocalStorageValue(USERNAME_KEY);
}

export function setSavedUsername(username: string | null) {
  writeLocalStorage(USERNAME_KEY, username);
}
