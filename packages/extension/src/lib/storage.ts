import type { AuthSessionState } from "./auth";

const STORAGE_KEY = "gpo-popup-session";

type StorageShape = {
  session: AuthSessionState | null;
};

export function loadStoredSession(): AuthSessionState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StorageShape;
    return parsed.session ?? null;
  } catch {
    return null;
  }
}

export function saveStoredSession(session: AuthSessionState): void {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      session,
    } satisfies StorageShape),
  );
}

export function clearStoredSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
