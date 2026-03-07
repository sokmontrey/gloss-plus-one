import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
}

export default function App() {
  return (
    <main className="flex min-w-[280px] flex-col gap-3 bg-background p-4 text-foreground">
      <p className="text-sm font-medium">GlossPlusOne</p>
      <p className="text-xs text-muted-foreground">Your language layer is active on this tab.</p>
      <Button size="sm" variant="outline" onClick={openDashboard} className="w-full justify-center gap-2">
        <ExternalLink className="h-3.5 w-3.5" />
        Open dashboard
      </Button>
    </main>
  );
}
