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

export interface AuthSessionResponse {
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

export function createCheckingSessionState(): AuthSessionState {
  return { status: "checking" };
}

export function createSignedOutSessionState(): AuthSessionState {
  return { status: "signed_out" };
}

export function createErrorSessionState(message: string): AuthSessionState {
  return {
    status: "error",
    message,
  };
}

export function isAuthenticatedSession(
  session: AuthSessionState,
): session is AuthenticatedSessionState {
  return session.status === "authenticated";
}

export function toStatusCopy(session: AuthSessionState): string {
  switch (session.status) {
    case "checking":
      return "Checking your session...";
    case "authenticated":
      return `Signed in as ${session.user.email}`;
    case "error":
      return session.message;
    case "signed_out":
    default:
      return "Sign in to sync your phrase bank and progress across devices.";
  }
}
