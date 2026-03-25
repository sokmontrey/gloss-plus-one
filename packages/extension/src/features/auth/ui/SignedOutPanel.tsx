type SignedOutPanelProps = {
  isBusy: boolean;
  onSignIn: () => Promise<void>;
};

export function SignedOutPanel({
  isBusy,
  onSignIn,
}: SignedOutPanelProps) {
  return (
    <section className="card">
      <span className="eyebrow">Authentication</span>
      <h2 className="title">Sign in to sync your phrase bank</h2>
      <p className="subtitle">
        Use your Google account to connect the extension to the new auth backend.
        Tokens stay on the server and the extension only works with the opaque
        session.
      </p>

      <button
        className="button button-primary"
        type="button"
        onClick={() => void onSignIn()}
        disabled={isBusy}
      >
        {isBusy ? "Opening Google sign in..." : "Continue with Google"}
      </button>

      <section className="panel">
        <h3 className="panel-title">How this flow works</h3>
        <p className="panel-copy">
          The popup opens the backend&apos;s Google sign-in route in a new tab,
          then checks for the server-owned session cookie to appear.
        </p>
      </section>
    </section>
  );
}
