import type { AuthenticatedSessionState } from "../model/session";

type SignedInPanelProps = {
  session: AuthenticatedSessionState;
  isLoggingOut: boolean;
  onLogout: () => Promise<void>;
};

export function SignedInPanel({
  session,
  isLoggingOut,
  onLogout,
}: SignedInPanelProps) {
  const displayName =
    session.profile?.displayName?.trim() || session.user.email;

  return (
    <section className="panel stack">
      <span className="eyebrow">Signed in</span>
      <h2 className="title">Welcome back</h2>
      <p className="subtitle">
        Connected as <strong>{displayName}</strong>
      </p>

      <div className="row">
        <span className="label">Email</span>
        <span className="value">{session.user.email}</span>
      </div>

      <div className="row">
        <span className="label">Session</span>
        <span className="value">Server-owned cookie is active</span>
      </div>

      <div className="panel">
        <p className="panel-title">What this unlocks</p>
        <p className="panel-copy">
          The extension can now render account-aware controls and later sync
          phrase bank, progress, and dashboard data through the backend.
        </p>
      </div>

      <button
        className="button button-danger"
        type="button"
        onClick={() => void onLogout()}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? "Logging out..." : "Log out"}
      </button>
    </section>
  );
}
