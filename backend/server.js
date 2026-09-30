// Backend API for the trust-ranked knowledge base demo, plus the built frontend (app/dist).
// No dependencies: Node's built-in http server. State lives in memory (see src/data.js).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { state, reset, roles, HttpError } from "./src/data.js";
import { search } from "./src/search.js";
import { recordSolved, approveProposal, requestAccess, patchDocument, reportDocument, ownerInbox, reviewReport, escalateConflict, conflictInbox, resolveConflict } from "./src/workflow.js";
import { aiMode } from "./src/gemini.js";
import { evaluate } from "./src/evaluation.js";

const PORT = Number(process.env.PORT) || 8787;
const DIST = fileURLToPath(new URL("../app/dist/", import.meta.url));

const routes = [
  ["GET", "/api/health", () => ({ ok: true, aiMode: aiMode() })],
  ["GET", "/api/bootstrap", () => ({
    clients: state.clients,
    roles: roles(),
    weights: state.weights.weights,
    weightsLabel: state.weights.label,
    disclosure: "Synthetic demo data. No real SD Worx documents, people or clients.",
    aiMode: aiMode(),
  })],
  ["POST", "/api/search", ({ body }) => search(body)],
  ["POST", "/api/solved", ({ body }) => recordSolved(body)],
  ["POST", "/api/proposals/:id/approve", ({ params, body }) => approveProposal(params.id, body)],
  ["GET", "/api/proposals", () => state.proposals],
  ["POST", "/api/access-requests", ({ body }) => requestAccess(body)],
  ["POST", "/api/reports", ({ body }) => reportDocument(body)],
  ["GET", "/api/reports", ({ query }) => ownerInbox(query.get("role"))],
  ["POST", "/api/reports/:id/review", ({ params, body }) => reviewReport(params.id, body)],
  ["POST", "/api/conflicts", ({ body }) => escalateConflict(body)],
  ["GET", "/api/conflicts", ({ query }) => conflictInbox(query.get("role"))],
  ["POST", "/api/conflicts/:id/resolve", ({ params, body }) => resolveConflict(params.id, body)],
  ["GET", "/api/audit", () => state.audit],
  ["GET", "/api/evaluation", () => evaluate()],
  ["PATCH", "/api/documents/:id", ({ params, body }) => patchDocument(params.id, body, body.role)],
  ["POST", "/api/reset", () => (reset(), { ok: true })],
].map(([method, path, handler]) => [method, new RegExp(`^${path.replace(/:(\w+)/g, "(?<$1>[^/]+)")}$`), handler]);

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

function send(res, status, body) {
  res.writeHead(status, { ...HEADERS, "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, { error: "Body must be JSON" });
  }
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json" };

// Serves the built frontend. Unknown paths get index.html so the single-page app can route.
async function serveStatic(path, res) {
  const file = normalize(path).replace(/^(\.\.[/\\])+/, "").replace(/^\/+/, "") || "index.html";
  for (const candidate of [file, "index.html"]) {
    try {
      const content = await readFile(DIST + candidate);
      res.writeHead(200, { "Content-Type": TYPES[extname(candidate)] ?? "application/octet-stream" });
      return res.end(content);
    } catch {}
  }
  send(res, 404, { error: "Frontend not built. Run npm run build in app/." });
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, null);
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;
  if (!path.startsWith("/api/")) return serveStatic(path, res);

  const route = routes.find(([method, pattern]) => method === req.method && pattern.test(path));
  if (!route) return send(res, 404, { error: "Not found" });
  try {
    const body = req.method === "GET" ? {} : await readBody(req);
    const params = route[1].exec(path).groups ?? {};
    send(res, 200, await route[2]({ body, params, query: url.searchParams }));
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, err.body);
    console.error(err);
    send(res, 500, { error: "Server error" });
  }
});

server.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));
