import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

function MicrosoftOAuthReturn() {
  const [message, setMessage] = useState("Finishing your Microsoft connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notifyOpenerAndClose = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
      code?: string,
      connectorId?: string | null,
    ) => {
      window.opener?.postMessage(
        { type, connectorId: connectorId ?? null, code: code ?? null },
        window.location.origin,
      );
      window.close();
    };

    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "Microsoft did not finish the connection.");
      notifyOpenerAndClose("appUserConnectorOAuthFailed");
      return;
    }

    const connectorId = params.get("connector_id");
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        notifyOpenerAndClose("appUserConnectorOAuthComplete", undefined, connectorId);
        return;
      }
      setMessage("Microsoft completed the connection without an exchange code.");
      notifyOpenerAndClose("appUserConnectorOAuthFailed");
      return;
    }
    notifyOpenerAndClose("appUserConnectorOAuthComplete", code, connectorId);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export const Route = createFileRoute("/oauth/microsoft/return")({
  component: MicrosoftOAuthReturn,
});
