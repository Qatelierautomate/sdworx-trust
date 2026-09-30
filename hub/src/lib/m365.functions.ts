import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { M365_CONNECTORS, M365_CONNECTOR_IDS, m365ClientEnvVar } from "./m365-options";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

const clientApiKey = (connectorId: string) => process.env[m365ClientEnvVar(connectorId)];

const areasSelect = "connector_id, resource_kind, resource_ref, display_name, notes";

async function readApprovedAreas(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("knowledge_allowlist")
    .select(areasSelect)
    .order("connector_id")
    .order("display_name");
  if (error) throw new Error(`Approved knowledge areas could not be read: ${error.message}`);
  return (data ?? []) as {
    connector_id: string;
    resource_kind: string;
    resource_ref: string;
    display_name: string;
    notes: string | null;
  }[];
}

export const getM365Status = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listConnectedConnectorIds } = await import("@/server/appUserConnections.server");
    const connected = await listConnectedConnectorIds(context.userId);
    const rows = await readApprovedAreas(context.supabase);
    return {
      connected,
      areas: rows,
      setupNeeded: M365_CONNECTORS.some((connector) => !clientApiKey(connector.connectorId)),
      missingClients: M365_CONNECTORS.filter((connector) => !clientApiKey(connector.connectorId)).map(
        (connector) => connector.connectorId,
      ),
    };
  });

export const startM365Connect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ connectorId: z.enum(M365_CONNECTOR_IDS) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const connector = M365_CONNECTORS.find((item) => item.connectorId === data.connectorId);
    if (!connector) throw new Error("Unknown Microsoft 365 source");
    const clientAPIKey = clientApiKey(connector.connectorId);
    if (!clientAPIKey) {
      throw new Error(
        `${m365ClientEnvVar(connector.connectorId)} is not set — a workspace admin must approve the Microsoft app for ${connector.label}.`,
      );
    }

    const request = getRequest();
    if (!request) throw new Error("Microsoft connection must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost =
      url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL(
      "/oauth/microsoft/return",
      sandboxHost ? `https://${sandboxHost}` : url.origin,
    ).toString();

    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const storedKey = await getConnectionKeyForUser(context.userId, connector.connectorId);

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: connector.connectorId,
      appUserId: context.userId,
      clientAPIKey,
      returnUrl,
      ...(storedKey ? { connectionAPIKey: storedKey } : {}),
      credentialsConfiguration: { scopes: [...connector.scopes] },
    });
    return { authorizationUrl };
  });

export const completeM365Connection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => {
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (!M365_CONNECTOR_IDS.includes(connectorId as (typeof M365_CONNECTOR_IDS)[number])) {
      throw new Error("Microsoft connection completed for an unexpected source");
    }
    const { saveConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey);
    return { ok: true, connectorId };
  });

export const disconnectM365Connection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ connectorId: z.enum(M365_CONNECTOR_IDS) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getConnectionKeyForUser, deleteConnectionKeyForUser } = await import(
      "@/server/appUserConnections.server"
    );
    const storedKey = await getConnectionKeyForUser(context.userId, data.connectorId);
    if (storedKey) {
      const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
      await disconnectAppUser({
        gatewayBaseUrl: GATEWAY_BASE_URL,
        connectionAPIKey: storedKey,
        connectorId: data.connectorId,
      });
    }
    await deleteConnectionKeyForUser(context.userId, data.connectorId);
    return { ok: true };
  });

export const searchM365Knowledge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        term: z.string().trim().min(2).max(120),
        connectorId: z.enum(M365_CONNECTOR_IDS).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const rows = await readApprovedAreas(context.supabase);

    const targets = M365_CONNECTORS.filter(
      (connector) => !data.connectorId || connector.connectorId === data.connectorId,
    );

    const results = await Promise.all(
      targets.map(async (connector) => {
        const connectionAPIKey = await getConnectionKeyForUser(
          context.userId,
          connector.connectorId,
        );
        if (!connectionAPIKey) {
          return { connectorId: connector.connectorId, connected: false, findings: [], failures: [], reconnectRequired: false };
        }
        const areas = rows
          .filter((row) => row.connector_id === connector.connectorId)
          .map((row) => ({
            connectorId: row.connector_id,
            resourceKind: row.resource_kind,
            resourceRef: row.resource_ref,
            displayName: row.display_name,
            notes: row.notes,
          }));
        const read = await (await import("./m365.server.ts")).readConnector({
          connectorId: connector.connectorId,
          connectionAPIKey,
          areas,
          term: data.term,
          scopes: [...connector.scopes],
        });
        return { ...read, connected: true };
      }),
    );

    return {
      results,
      approvedAreas: rows.length,
    };
  });
