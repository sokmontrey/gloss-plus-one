import { useCallback, useEffect, useState } from "react";
import {
  getGoogleSignInUrl,
  getSession,
  logout,
  SESSION_POLL_INTERVAL_MS,
} from "../api/authClient";
import type { AuthSessionState } from "./session";
import {
  createCheckingSessionState,
  createErrorSessionState,
  createSignedOutSessionState,
  isAuthenticatedSession,
} from "./session";
import {
  clearStoredAuthSession,
  loadStoredAuthSession,
  saveStoredAuthSession,
} from "../../../shared/lib/storage/localSession";
import { openExternalUrl } from "../../../shared/lib/browser/tabs";

const SIGN_IN_POLL_ATTEMPT_LIMIT = 20;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useAuthSession() {
  const [signInAttempts, setSignInAttempts] = useState(0);
  const [session, setSession] = useState<AuthSessionState>(() => {
    const storedSession = loadStoredAuthSession<AuthSessionState>();
    return storedSession ?? createCheckingSessionState();
  });
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const refreshSession = useCallback(async () => {
    setSession((current) =>
      isAuthenticatedSession(current) ? current : createCheckingSessionState(),
    );

    const nextSession = await getSession();
    setSession(nextSession);

    if (isAuthenticatedSession(nextSession)) {
      saveStoredAuthSession(nextSession);
      return nextSession;
    }

    clearStoredAuthSession();
    return nextSession;
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (!isSigningIn) {
      setSignInAttempts(0);
      return undefined;
    }

    const interval = window.setInterval(async () => {
      const nextSession = await refreshSession();

      setSignInAttempts((current) => {
        const nextCount = current + 1;
        const timedOut = nextCount >= SIGN_IN_POLL_ATTEMPT_LIMIT;
        const shouldStopPolling =
          isAuthenticatedSession(nextSession) || timedOut;

        if (shouldStopPolling) {
          setIsSigningIn(false);

          if (timedOut && nextSession.status === "signed_out") {
            setSession({
              status: "error",
              message:
                "Sign-in is still pending. Finish the Google flow, then click Refresh.",
            });
          }
        }

        return timedOut ? 0 : nextCount;
      });
    }, SESSION_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [isSigningIn, refreshSession]);

  const signIn = useCallback(async () => {
    setIsSigningIn(true);
    setSession((current) =>
      current.status === "error" ? createSignedOutSessionState() : current,
    );

    try {
      await openExternalUrl(getGoogleSignInUrl());
    } catch (error) {
      setSession(
        createErrorSessionState(
          getErrorMessage(error, "Unable to open sign-in page."),
        ),
      );
      setIsSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoggingOut(true);

    try {
      await logout();
      clearStoredAuthSession();
      setSession(createSignedOutSessionState());
    } catch (error) {
      setSession(
        createErrorSessionState(getErrorMessage(error, "Unable to log out.")),
      );
    } finally {
      setIsLoggingOut(false);
    }
  }, []);

  return {
    state: session,
    isSigningIn,
    isLoggingOut,
    refreshSession,
    startSignIn: signIn,
    logout: signOut,
  };
}
