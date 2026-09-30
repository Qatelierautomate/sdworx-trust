// Server-only: Microsoft Graph reads through the connector gateway.
// Imported dynamically from server functions, never from the browser.
import {
  appUserReconnectRequired,
  callAsAppUser,
} from "@/integrations/lovable/appUserConnector";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";

export interface ApprovedArea {
  connectorId: string;
  resourceKind: string;
  resourceRef: string;
  displayName: string;
  notes?: string | null;
}

export interface Finding {
  connectorId: string;
  area: string;
  title: string;
  snippet: string;
  at?: string | null;
}

export interface AreaFailure {
  connectorId: string;
  area: string;
  reason: string;
}

export interface ConnectorReadResult {
  connectorId: string;
  findings: Finding[];
  failures: AreaFailure[];
  reconnectRequired: boolean;
}

// Microsoft Graph payloads are external data; treat them loosely here and
// return only the fields the hub renders.
type GraphItem = any;

const shortText = (value: string, max = 220) => {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
};

const asString = (value: unknown) => (typeof value === "string" ? value : "");

const matches = (haystack: string, term: string) =>
  !term || haystack.toLowerCase().includes(term.toLowerCase());

async function graph(
  connectionAPIKey: string,
  connectorId: string,
  path: string,
  requiredScopes: string[],
) {
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId,
    path,
    requiredScopes,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      `Microsoft Graph read failed [${connectorId}] ${res.status}: ${body.slice(0, 300)}`,
    );
    return { ok: false as const, status: res.status, body };
  }
  const payload = (await res.json()) as { value?: GraphItem[] };
  return { ok: true as const, items: Array.isArray(payload.value) ? payload.value : [] };
}

async function readOutlook(
  connectionAPIKey: string,
  area: ApprovedArea,
  term: string,
  scopes: string[],
) {
  const folder =
    area.resourceKind === "inbox" || !area.resourceRef ? "inbox" : area.resourceRef;
  const res = await graph(
    connectionAPIKey,
    "microsoft_outlook",
    `/me/mailfolders/${encodeURIComponent(folder)}/messages?$top=15&$select=subject,bodyPreview,receivedDateTime`,
    scopes,
  );
  if (!res.ok) throw new Error(`Mailbox could not be read (${res.status})`);
  return res.items
    .filter((item) => matches(`${asString(item.subject)} ${asString(item.bodyPreview)}`, term))
    .slice(0, 3)
    .map((item) => ({
      title: asString(item.subject) || "(no subject)",
      snippet: shortText(asString(item.bodyPreview)),
      at: asString(item.receivedDateTime) || null,
    }));
}

async function readTeams(
  connectionAPIKey: string,
  area: ApprovedArea,
  term: string,
  scopes: string[],
) {
  if (!area.resourceRef.includes(":")) {
    throw new Error("Approved area is not linked to a channel yet");
  }
  const [teamRef = "", channelRef = ""] = area.resourceRef.split(":");
  const res = await graph(
    connectionAPIKey,
    "microsoft_teams",
    `/teams/${encodeURIComponent(teamRef)}/channels/${encodeURIComponent(channelRef)}/messages?$top=15`,
    scopes,
  );
  if (!res.ok) throw new Error(`Channel could not be read (${res.status})`);
  return res.items
    .filter((item) => matches(asString(item.body?.content), term))
    .slice(0, 3)
    .map((item) => ({
      title: asString(item.from?.displayName)
        ? `Message from ${asString(item.from?.displayName)}`
        : "Channel message",
      snippet: shortText(asString(item.body?.content)),
      at: asString(item.publishedDateTime) || null,
    }));
}

async function readSharePoint(
  connectionAPIKey: string,
  area: ApprovedArea,
  term: string,
  scopes: string[],
) {
  const res = await graph(
    connectionAPIKey,
    "microsoft_sharepoint",
    `/sites/${encodeURIComponent(area.resourceRef)}/pages?$top=15&$select=title,webUrl`,
    scopes,
  );
  if (!res.ok) throw new Error(`Site could not be read (${res.status})`);
  return res.items
    .filter((item) => matches(asString(item.title), term))
    .slice(0, 3)
    .map((item) => ({
      title: asString(item.title) || "Untitled page",
      snippet: shortText(asString(item.webUrl) || "SharePoint page"),
      at: null as string | null,
    }));
}

async function readOneDrive(
  connectionAPIKey: string,
  area: ApprovedArea,
  term: string,
  scopes: string[],
) {
  const path =
    area.resourceKind === "root" || !area.resourceRef
      ? `/me/drive/root/children?$top=15&$select=name,webUrl,folder`
      : `/me/drive/root:/${encodeURIComponent(area.resourceRef)}:/children?$top=15&$select=name,webUrl,folder`;
  const res = await graph(connectionAPIKey, "microsoft_onedrive", path, scopes);
  if (!res.ok) throw new Error(`Files could not be read (${res.status})`);
  return res.items
    .filter((item) => matches(asString(item.name), term))
    .slice(0, 3)
    .map((item) => ({
      title: asString(item.name) || "Untitled item",
      snippet: shortText(asString(item.webUrl) || "Shared document"),
      at: null as string | null,
    }));
}

const READERS: Record<
  string,
  (key: string, area: ApprovedArea, term: string, scopes: string[]) => Promise<
    { title: string; snippet: string; at: string | null }[]
  >
> = {
  microsoft_outlook: readOutlook,
  microsoft_teams: readTeams,
  microsoft_sharepoint: readSharePoint,
  microsoft_onedrive: readOneDrive,
};

export async function readConnector(params: {
  connectorId: string;
  connectionAPIKey: string;
  areas: ApprovedArea[];
  term: string;
  scopes: string[];
}): Promise<ConnectorReadResult> {
  const reader = READERS[params.connectorId];
  if (!reader) {
    return { connectorId: params.connectorId, findings: [], failures: [], reconnectRequired: false };
  }

  const findings: Finding[] = [];
  const failures: AreaFailure[] = [];

  for (const area of params.areas.slice(0, 5)) {
    try {
      const items = await reader(params.connectionAPIKey, area, params.term, params.scopes);
      for (const item of items) {
        findings.push({ connectorId: params.connectorId, area: area.displayName, ...item });
      }
    } catch (error) {
      failures.push({
        connectorId: params.connectorId,
        area: area.displayName,
        reason: error instanceof Error ? error.message : "This approved area could not be read",
      });
    }
  }

  return { connectorId: params.connectorId, findings, failures, reconnectRequired: false };
}

export async function probeConnection(params: {
  connectorId: string;
  connectionAPIKey: string;
  scopes: string[];
}) {
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey: params.connectionAPIKey,
    connectorId: params.connectorId,
    path: "/me?$select=displayName,mail,userPrincipalName",
    requiredScopes: params.scopes,
  });
  if (await appUserReconnectRequired(res)) return { ok: false, reconnectRequired: true };
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      `Microsoft probe failed [${params.connectorId}] ${res.status}: ${body.slice(0, 300)}`,
    );
    return { ok: false, reconnectRequired: false };
  }
  const value = (await res.json()) as GraphItem;
  const account = asString(value.mail) || asString(value.userPrincipalName) || null;
  return { ok: true, reconnectRequired: false, account };
}
