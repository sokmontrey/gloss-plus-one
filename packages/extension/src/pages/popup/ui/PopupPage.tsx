import { SignedInPanel } from "../../../features/auth/ui/SignedInPanel";
import { SignedOutPanel } from "../../../features/auth/ui/SignedOutPanel";
import { useAuthSession } from "../../../features/auth/model/useAuthSession";
import { toStatusCopy } from "../../../features/auth/model/session";
import { PopupHeader } from "../../../shared/ui/PopupHeader";
import { PopupStatusCard } from "./PopupStatusCard";

export function PopupPage() {
  const auth = useAuthSession();

  return (
    <main className="popup-shell">
      <PopupHeader
        title="Learn while you browse."
        description="Connect the extension to your auth backend so progress and phrase bank updates can live behind a secure server-owned session."
      />
      <PopupStatusCard
        message={toStatusCopy(auth.state)}
        isRefreshing={auth.state.status === "checking"}
        onRefresh={auth.refreshSession}
      />

      {auth.state.status === "authenticated" ? (
        <SignedInPanel
          session={auth.state}
          isLoggingOut={auth.isLoggingOut}
          onLogout={auth.logout}
        />
      ) : (
        <SignedOutPanel
          isBusy={auth.isSigningIn || auth.state.status === "checking"}
          onSignIn={auth.startSignIn}
        />
      )}
    </main>
  );
}
