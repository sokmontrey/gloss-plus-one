import { Button } from "../../../shared/ui/button";
import { Card, CardContent } from "../../../shared/ui/card";

type PopupStatusCardProps = {
  message: string;
  isRefreshing: boolean;
  onRefresh: () => Promise<unknown>;
};

export function PopupStatusCard({
  message,
  isRefreshing,
  onRefresh,
}: PopupStatusCardProps) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-lg backdrop-blur">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Account
          </span>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => void onRefresh()}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
        <p className="text-sm text-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
