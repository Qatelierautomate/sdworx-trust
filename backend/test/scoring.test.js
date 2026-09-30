import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreDocument, trackRecord, weakestFactor } from "../src/scoring.js";
import { rankRelevance } from "../src/relevance.js";

const now = new Date("2026-09-30");
const config = {
  weights: { current: 0.3, sourceType: 0.2, owned: 0.15, appliesHere: 0.15, trackRecord: 0.2 },
  sourceTypeValues: { policy: 1, "expert-note": 0.7, chat: 0.3 },
  trackRecord: { capCases: 3, halfLifeMonths: 12 },
};
const client = { country: "BE", clientType: "mid-size" };
const doc = (over = {}) => ({
  id: "X1", sourceType: "policy", ownerRole: "Owner", date: "2026-09-01", reviewIntervalMonths: 6,
  supersedes: [], contradicts: [], country: "BE", clientType: "all", keywords: [], ...over,
});
const score = (d, extra = {}) =>
  scoreDocument(d, { client, cases: [], weights: config, now, supersededMap: new Map(), helpRole: "Help", ...extra });

test("a fresh, owned, local policy scores the full non-track weight", () => {
  const r = score(doc());
  assert.equal(r.status, "ok");
  assert.equal(Math.round(r.total * 100) / 100, 0.8);
});

test("current falls linearly after the review interval and reaches 0 at twice it", () => {
  assert.equal(score(doc({ date: "2026-01-01" })).factors.current, 0.51);
  const stale = score(doc({ date: "2025-06-01" }));
  assert.equal(stale.factors.current, 0);
  assert.equal(stale.status, "outdated");
});

test("superseded documents are capped at 0.2 and marked outdated", () => {
  const r = score(doc(), { supersededMap: new Map([["X1", "X2"]]) });
  assert.equal(r.total, 0.2);
  assert.equal(r.status, "outdated");
  assert.match(r.reasons[0], /replaced by a newer version/);
});

test("contradictions flag the document as a conflict", () => {
  const r = score(doc(), { conflictsWith: ["X9"] });
  assert.equal(r.status, "conflict");
  assert.ok(r.reasons.some((x) => x.includes("Contradicted by another source")));
});

test("no owner means owned 0, status ownerless, and the fallback helper is named", () => {
  const r = score(doc({ ownerRole: null }));
  assert.equal(r.factors.owned, 0);
  assert.equal(r.status, "ownerless");
  assert.ok(r.reasons.includes("Who can help: Help"));
});

test("a different client type halves applies-here", () => {
  assert.equal(score(doc({ clientType: "enterprise" })).factors.appliesHere, 0.5);
});

test("track record only counts cases in exactly the client's scope", () => {
  const cases = [
    { documentId: "X1", scope: { country: "BE", clientType: "mid-size" }, date: "2026-09-30" },
    { documentId: "X1", scope: { country: "FR", clientType: "mid-size" }, date: "2026-09-30" },
    { documentId: "X1", scope: { country: "BE", clientType: "enterprise" }, date: "2026-09-30" },
  ];
  const t = trackRecord(doc(), client, cases, now, config.trackRecord);
  assert.equal(t.count, 1);
  assert.equal(Math.round(t.value * 100) / 100, 0.33);
});

test("older cases count less and the track record is capped at 3", () => {
  const recent = Array.from({ length: 5 }, () => ({ documentId: "X1", scope: client, date: "2026-09-30" }));
  assert.equal(trackRecord(doc(), client, recent, now, config.trackRecord).value, 1);
  const old = [{ documentId: "X1", scope: client, date: "2025-09-30" }];
  assert.ok(Math.abs(trackRecord(doc(), client, old, now, config.trackRecord).value - 0.5 / 3) < 0.01);
});

test("weakest factor picks the lowest value, heaviest weight on ties", () => {
  const factors = { current: 1, sourceType: 1, owned: 0, appliesHere: 1, trackRecord: 0 };
  assert.equal(weakestFactor(factors, config.weights), "trackRecord");
});

test("relevance understands everyday phrasing and ignores off-topic questions", () => {
  const docs = [
    { id: "A", title: "Mid-month salary change", snippet: "Pro rata.", keywords: ["salary change", "mid-month"] },
    { id: "B", title: "Sick leave deadlines", snippet: "Report within two days.", keywords: ["sick leave"] },
  ];
  const raise = rankRelevance("An employee got a raise halfway through the month", docs);
  assert.equal(raise.get("A").relevance, 1);
  assert.equal(raise.get("B").relevance, 0);
  const offTopic = rankRelevance("What is the capital of France?", docs);
  assert.equal(offTopic.get("A").relevance + offTopic.get("B").relevance, 0);
});
