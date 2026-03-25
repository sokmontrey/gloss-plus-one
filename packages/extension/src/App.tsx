import { useCallback, useEffect, useMemo, useState } from "react";
import { LoggedInView } from "./components/LoggedInView";
import { LoggedOutView } from "./components/LoggedOutView";
import {
  type AuthSessionState,
  getLoginUrl,
  getSession,
  getSignedOutState,
  logout,
  SESSION_POLL_INTERVAL_MS,
} from "./lib/auth";
import {
  clearStoredSession,
  loadStoredSession,
  saveStoredSession,
} from "./lib/storage";

function getStatusCopy(session: AuthSessionState): string {
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

export default function App() {
  const [signInAttempts, setSignInAttempts] = useState(0);
  const [session, setSession] = useState<AuthSessionState>(() => {
    const storedSession = loadStoredSession();
    return storedSession ?? { status: "checking" };
  });
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const refreshSession = useCallback(async () => {
    setSession((current) =>
      current.status === "authenticated" ? current : { status: "checking" },
    );

    const nextSession = await getSession();
    setSession(nextSession);

    if (nextSession.status === "authenticated") {
      saveStoredSession(nextSession);
      return nextSession;
    }

    clearStoredSession();
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
        const timedOut = nextCount >= 20;

        const shouldStopPolling =
          nextSession.status === "authenticated" || timedOut;

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

  const handleSignIn = useCallback(async () => {
    setIsSigningIn(true);
    setSession((current) =>
      current.status === "error" ? getSignedOutState() : current,
    );

    const loginUrl = getLoginUrl();
    try {
      if (typeof chrome !== "undefined" && chrome.tabs?.create) {
        await chrome.tabs.create({ url: loginUrl });
      } else {
        window.open(loginUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to open sign-in page.";
      setSession({ status: "error", message });
      setIsSigningIn(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    await refreshSession();
  }, [refreshSession]);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      clearStoredSession();
      setSession(getSignedOutState());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to log out.";
      setSession({ status: "error", message });
    } finally {
      setIsLoggingOut(false);
    }
  }, []);

  const statusCopy = useMemo(() => getStatusCopy(session), [session]);

  return (
    <main className="popup-shell">
      <header className="hero">
        <div className="hero__eyebrow">GlossPlusOne</div>
        <h1>Learn while you browse.</h1>
        <p>
          Connect the extension to your auth backend so progress and phrase bank
          updates can live behind a secure server-owned session.
        </p>
      </header>

      <section className="status-card">
        <div className="status-card__row">
          <span className="status-card__label">Account</span>
          <button
            className="ghost-button"
            type="button"
            onClick={() => void handleRefresh()}
            disabled={session.status === "checking"}
          >
            Refresh
          </button>
        </div>
        <p className="status-card__message">{statusCopy}</p>
      </section>

      {session.status === "authenticated" ? (
        <LoggedInView
          session={session}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
        />
      ) : (
        <LoggedOutView
          onSignIn={handleSignIn}
          isBusy={isSigningIn || session.status === "checking"}
        />
      )}
    </main>
  );
}
