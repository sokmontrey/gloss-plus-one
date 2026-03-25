import { getBackendRouteUrl } from "../../../shared/config/env";
import type { AuthSessionState, AuthSessionResponse } from "../model/session";
import {
  createErrorSessionState,
  createSignedOutSessionState,
} from "../model/session";

export const SESSION_POLL_INTERVAL_MS = 1500;

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(getBackendRouteUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 401) {
    return { status: "unauthenticated" } as T;
  }

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getGoogleSignInUrl(): string {
  return getBackendRouteUrl("/auth/google/start");
}

export async function getSession(): Promise<AuthSessionState> {
  try {
    const response = await request<AuthSessionResponse>("/auth/me", {
      method: "GET",
    });

    if (response.status === "unauthenticated" || !response.user) {
      return createSignedOutSessionState();
    }

    return {
      status: "authenticated",
      user: response.user,
      profile: response.profile ?? null,
    };
  } catch (error) {
    return createErrorSessionState(
      toErrorMessage(
        error,
        "Unable to reach the auth backend. Check VITE_API_BASE_URL.",
      ),
    );
  }
}

export async function logout(): Promise<void> {
  await request("/auth/logout", {
    method: "POST",
  });
}
