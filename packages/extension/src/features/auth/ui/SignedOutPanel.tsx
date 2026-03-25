import { Globe, ShieldCheck } from "lucide-react";
import { Button } from "../../../shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../shared/ui/card";
import { Badge } from "../../../shared/ui/badge";

type SignedOutPanelProps = {
  isBusy: boolean;
  onSignIn: () => Promise<void>;
};

export function SignedOutPanel({
  isBusy,
  onSignIn,
}: SignedOutPanelProps) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-lg backdrop-blur">
      <CardHeader className="space-y-3">
        <Badge variant="secondary" className="w-fit">
          Authentication
        </Badge>
        <div className="space-y-2">
          <CardTitle className="text-2xl leading-tight">
            Sign in to sync your phrase bank
          </CardTitle>
          <CardDescription className="text-sm leading-6">
            Use your Google account to connect the extension to the new auth
            backend. Tokens stay on the server and the extension only works with
            the opaque session.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          className="w-full"
          size="lg"
          type="button"
          onClick={() => void onSignIn()}
          disabled={isBusy}
        >
          <Globe className="size-4" />
          {isBusy ? "Opening Google sign in..." : "Continue with Google"}
        </Button>

        <div className="rounded-xl border border-border/70 bg-muted/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="size-4 text-primary" />
            How this flow works
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            The popup opens the backend&apos;s Google sign-in route in a new tab,
            then checks for the server-owned session cookie to appear.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
