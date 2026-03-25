import { getAuthRouteUrl, getBackendBaseUrl } from "./config";

export const SESSION_POLL_INTERVAL_MS = 1500;

export type AuthSessionState =
  | {
      status: "checking";
    }
  | {
      status: "signed_out";
    }
  | {
      status: "authenticated";
      user: {
        userId: string;
        email: string;
      };
      profile?: {
        id?: string;
        authUserId?: string;
        email?: string;
        displayName?: string | null;
      } | null;
    }
  | {
      status: "error";
      message: string;
    };

export type AuthenticatedSessionState = Extract<
  AuthSessionState,
  { status: "authenticated" }
>;

interface AuthSessionResponse {
  status: "authenticated" | "unauthenticated";
  user?: {
    userId: string;
    email: string;
  };
  profile?: {
    id?: string;
    authUserId?: string;
    email?: string;
    displayName?: string | null;
  } | null;
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getBackendBaseUrl()}${path}`, {
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

export function getSignedOutState(): AuthSessionState {
  return { status: "signed_out" };
}

export function getLoginUrl(): string {
  return getAuthRouteUrl("/auth/google/start");
}

export async function getSession(): Promise<AuthSessionState> {
  try {
    const response = await request<AuthSessionResponse>("/auth/me", {
      method: "GET",
    });

    if (response.status === "unauthenticated" || !response.user) {
      return getSignedOutState();
    }

    return {
      status: "authenticated",
      user: response.user,
      profile: response.profile ?? null,
    };
  } catch (error) {
    return {
      status: "error",
      message: toErrorMessage(
        error,
        "Unable to reach the auth backend. Check VITE_API_BASE_URL.",
      ),
    };
  }
}

export async function logout(): Promise<void> {
  await request("/auth/logout", {
    method: "POST",
  });
}
