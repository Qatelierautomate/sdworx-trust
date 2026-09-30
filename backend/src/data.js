// In-memory demo state, loaded from the synthetic fixtures in app/src/data.
// No database by design: POST /api/reset restores the start state before each pitch run.
import { readFileSync } from "node:fs";

const load = (name) =>
  JSON.parse(readFileSync(new URL(`../../app/src/data/${name}.json`, import.meta.url), "utf8"));

const fixtures = {
  documents: load("documents"),
  cases: load("cases"),
  clients: load("clients"),
  weights: load("weights"),
};

// Scores are computed against a fixed date so the demo and screenshots never drift.
export const DEMO_NOW = new Date(process.env.DEMO_NOW || "2026-09-30");
export const today = () => DEMO_NOW.toISOString().slice(0, 10);

export const state = {};

export function reset() {
  Object.assign(state, structuredClone(fixtures), { proposals: [], reports: [], conflicts: [], audit: [] });
}
reset();

export class HttpError extends Error {
  constructor(status, body) {
    super(body.error);
    this.status = status;
    this.body = body;
  }
}

export const findClient = (id) => {
  const client = state.clients.find((c) => c.id === id);
  if (!client) throw new HttpError(404, { error: `Unknown client ${id}` });
  return client;
};

// Lets a frontend send a country name and customer type instead of one of our demo client ids.
const COUNTRY_CODES = { belgium: "BE", france: "FR", netherlands: "NL" };
const CLIENT_TYPES = { sme: "mid-size", "mid-market": "mid-size", "mid-size": "mid-size", enterprise: "enterprise" };

export function resolveClient({ clientId, country, customerType }) {
  if (clientId) return findClient(clientId);
  if (!country || !customerType) throw new HttpError(400, { error: "Send clientId, or country and customerType" });
  const code = COUNTRY_CODES[String(country).toLowerCase()] ?? String(country).slice(0, 2).toUpperCase();
  const clientType = CLIENT_TYPES[String(customerType).toLowerCase()];
  if (!clientType) throw new HttpError(400, { error: `Unknown customerType ${customerType}` });
  const sample = state.clients.find((c) => c.country === code);
  return {
    id: `${code}-${clientType}`,
    name: `${country} ${customerType} client`,
    country: code,
    clientType,
    sampleQuestions: sample?.sampleQuestions ?? state.clients[0].sampleQuestions,
  };
}

export const findDocument = (id) => {
  const doc = state.documents.find((d) => d.id === id);
  if (!doc) throw new HttpError(404, { error: `Unknown document ${id}` });
  return doc;
};

// Who to ask when a document has no owner or nothing reliable was found.
export const countryPolicyOwner = (country) =>
  state.documents.find((d) => d.country === country && d.sourceType === "policy" && d.ownerRole)
    ?.ownerRole ?? "Payroll operations lead";

export const roles = () => [...new Set(state.documents.flatMap((d) => d.accessRoles))];

// Simulated permissions (role switcher). Every demo role is a consultant, so it also sees
// documents open to all consultants.
export const canSee = (doc, role) =>
  roles().includes(role) && (doc.accessRoles.includes(role) || doc.accessRoles.includes("all-consultants"));
