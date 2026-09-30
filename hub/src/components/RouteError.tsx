import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RouteError({ error, resetError }: { error: unknown; resetError?: () => void }) {
  const message = error instanceof Error ? error.message : String(error);
  const aborted = /abort/i.test(message);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md border bg-surface-raised p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" />
          <div className="min-w-0">
            <h1 className="font-display text-lg font-semibold">This part of the Hub did not load</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {aborted
                ? "The connection to the server was interrupted before the page finished loading. Nothing you typed was lost."
                : "Something went wrong while loading this page. Nothing you typed was lost."}
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => (resetError ? resetError() : window.location.reload())}>
            <RotateCw /> Try again
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.location.assign("/")}>
            Go to workspace
          </Button>
        </div>
        <p className="mt-4 truncate text-xs text-muted-foreground" title={message}>
          Details: {message || "Unknown error"}
        </p>
      </div>
    </div>
  );
}
