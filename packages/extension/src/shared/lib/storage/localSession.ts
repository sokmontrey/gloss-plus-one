export function loadFromLocalStorage<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveToLocalStorage<T>(key: string, value: T): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeFromLocalStorage(key: string): void {
  window.localStorage.removeItem(key);
}

const AUTH_SESSION_STORAGE_KEY = "gpo-popup-session";

type AuthSessionStorageShape<T> = {
  session: T;
};

export function loadStoredAuthSession<T>(): T | null {
  const stored = loadFromLocalStorage<AuthSessionStorageShape<T>>(
    AUTH_SESSION_STORAGE_KEY,
  );

  return stored?.session ?? null;
}

export function saveStoredAuthSession<T>(session: T): void {
  saveToLocalStorage(AUTH_SESSION_STORAGE_KEY, { session });
}

export function clearStoredAuthSession(): void {
  removeFromLocalStorage(AUTH_SESSION_STORAGE_KEY);
}
