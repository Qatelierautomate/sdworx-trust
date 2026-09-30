// End-to-end over HTTP: scenario 1 -> 2 -> audit -> reset, as the frontend will call it.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const PORT = 8799;
const base = `http://localhost:${PORT}`;
let server;

before(async () => {
  server = spawn("node", ["server.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(PORT), SERVER_AI_API_KEY: "" },
  });
  await new Promise((resolve) => server.stdout.once("data", resolve));
});

after(() => server.kill());

const call = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

test("health and bootstrap", async () => {
  assert.deepEqual((await call("GET", "/api/health")).body, { ok: true, aiMode: "template" });
  const { body } = await call("GET", "/api/bootstrap");
  assert.equal(body.clients.length, 3);
  assert.deepEqual(body.roles, ["all-consultants", "key-account-team"]);
});

test("search, solve, approve, audit, reset", async () => {
  const retro = { question: "Can we correct a closed pay run retroactively?", clientId: "CL2", role: "all-consultants" };
  assert.equal((await call("POST", "/api/search", retro)).body.results[0].docId, "D11");

  const solved = await call("POST", "/api/solved", { ...retro, docId: "D12" });
  assert.equal(solved.body.search.results[0].docId, "D12");

  const denied = await call("POST", `/api/proposals/${solved.body.proposal.id}/approve`, { role: "all-consultants", decision: "approve" });
  assert.equal(denied.status, 403);
  const approved = await call("POST", `/api/proposals/${solved.body.proposal.id}/approve`, { role: "Payroll France client team", decision: "approve" });
  assert.equal(approved.status, 200);

  assert.deepEqual((await call("GET", "/api/audit")).body.map((a) => a.action), ["approve-update", "solved-case"]);
  await call("POST", "/api/reset");
  assert.deepEqual((await call("GET", "/api/audit")).body, []);
});

test("errors come back as JSON with the right status", async () => {
  assert.equal((await call("POST", "/api/search", { question: "", clientId: "CL1", role: "all-consultants" })).status, 400);
  assert.equal((await call("POST", "/api/search", { question: "x", clientId: "NOPE", role: "all-consultants" })).status, 404);
  assert.equal((await call("GET", "/api/nope")).status, 404);
});
