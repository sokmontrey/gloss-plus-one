import { Badge } from "../../../shared/ui/badge";
import { Button } from "../../../shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../shared/ui/card";
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
    <Card className="border-slate-200/80 bg-white/85 shadow-lg backdrop-blur">
      <CardHeader className="space-y-3">
        <Badge className="w-fit">Signed in</Badge>
        <div className="space-y-1">
          <CardTitle className="text-2xl font-semibold text-slate-950">
            Welcome back
          </CardTitle>
          <CardDescription className="text-sm leading-6 text-slate-600">
            Connected as <span className="font-semibold text-slate-900">{displayName}</span>
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/90 p-4">
          <div className="flex items-start justify-between gap-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Email
            </span>
            <span className="text-right text-sm font-medium text-slate-900">
              {session.user.email}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Session
            </span>
            <span className="text-right text-sm font-medium text-slate-900">
              Server-owned cookie is active
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/70 p-4">
          <p className="text-sm font-semibold text-slate-950">What this unlocks</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            The extension can now render account-aware controls and later sync
            phrase bank, progress, and dashboard data through the backend.
          </p>
        </div>

        <Button
          variant="destructive"
          className="w-full"
          type="button"
          onClick={() => void onLogout()}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? "Logging out..." : "Log out"}
        </Button>
      </CardContent>
    </Card>
  );
}
