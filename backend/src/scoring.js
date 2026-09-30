// Trust scoring per the MVP contract: five visible factors x weights, plus gates.
const MONTH_MS = 30.4375 * 24 * 3600 * 1000;
const SUPERSEDED_CAP = 0.2;
// Reports and owner reviews (adopted from Arne's design): a crowd can nudge a score,
// only the owner can make the big change.
const REPORT_PENALTY = 0.05;
const MAX_REPORT_PENALTY = 0.15;
const CONFIRMED_CORRECT_FLOOR = 0.9;
const CONFIRMED_OUTDATED_CAP = 0.05;

export const FACTOR_LABELS = {
  current: "current",
  sourceType: "source type",
  owned: "owned",
  appliesHere: "applies here",
  trackRecord: "track record",
};

export const ageMonths = (date, now) => (now - new Date(date)) / MONTH_MS;

// Maps a superseded document id to the id of the document that replaces it.
export const supersededBy = (documents) =>
  new Map(documents.flatMap((d) => d.supersedes.map((old) => [old, d.id])));

export const appliesToCountry = (doc, client) => doc.country === "ALL" || doc.country === client.country;

// 1 within the review interval, falling linearly to 0 at twice the interval. 0 if superseded.
function currentValue(doc, now, isSuperseded) {
  if (isSuperseded) return 0;
  if (!doc.date || !doc.reviewIntervalMonths) return null;
  const age = ageMonths(doc.date, now);
  const interval = doc.reviewIntervalMonths;
  return Math.max(0, Math.min(1, 1 - (age - interval) / interval));
}

function appliesHereValue(doc, client) {
  if (!appliesToCountry(doc, client)) return 0;
  return doc.clientType === "all" || doc.clientType === client.clientType ? 1 : 0.5;
}

// Only cases in exactly this client's scope count, older cases count less.
export function trackRecord(doc, client, cases, now, { capCases, halfLifeMonths }) {
  const inScope = cases.filter(
    (c) =>
      c.documentId === doc.id &&
      c.scope.country === client.country &&
      c.scope.clientType === client.clientType,
  );
  const weighted = inScope.reduce((sum, c) => sum + 0.5 ** (ageMonths(c.date, now) / halfLifeMonths), 0);
  return { value: Math.min(weighted, capCases) / capCases, count: inScope.length };
}

export function weakestFactor(factors, weights) {
  return Object.keys(weights).reduce((weakest, key) => {
    const value = factors[key] ?? 0;
    const current = factors[weakest] ?? 0;
    if (value < current || (value === current && weights[key] > weights[weakest])) return key;
    return weakest;
  });
}

const round = (n) => (n === null ? null : Math.round(n * 100) / 100);

// ctx: { client, cases, weights (weights.json), now, supersededMap, conflictsWith, titles, helpRole }
export function scoreDocument(doc, ctx) {
  const { client, cases, now, supersededMap, conflictsWith = [], titles = {}, helpRole, reports = [] } = ctx;
  const { weights, sourceTypeValues } = ctx.weights;
  const replacedBy = supersededMap.get(doc.id);
  const track = trackRecord(doc, client, cases, now, ctx.weights.trackRecord);

  const factors = {
    current: currentValue(doc, now, Boolean(replacedBy)),
    sourceType: sourceTypeValues[doc.sourceType] ?? null,
    owned: doc.ownerRole && doc.date ? 1 : 0,
    appliesHere: appliesHereValue(doc, client),
    trackRecord: track.value,
  };
  let total = Object.keys(weights).reduce((sum, k) => sum + weights[k] * (factors[k] ?? 0), 0);
  if (replacedBy) total = Math.min(total, SUPERSEDED_CAP);
  const openReports = reports.filter((r) => r.docId === doc.id && r.status === "open"); // decided reports no longer count
  total = Math.max(0, total - Math.min(MAX_REPORT_PENALTY, REPORT_PENALTY * openReports.length));
  if (doc.review === "correct") total = Math.max(total, CONFIRMED_CORRECT_FLOOR);
  if (doc.review === "outdated") total = Math.min(total, CONFIRMED_OUTDATED_CAP);

  const outdated = Boolean(replacedBy) || factors.current === 0 || doc.review === "outdated";
  const conflict = conflictsWith.length > 0;
  const ownerless = factors.owned === 0;
  const status = outdated ? "outdated" : conflict ? "conflict" : ownerless ? "ownerless" : "ok";

  const reasons = [];
  if (replacedBy) reasons.push(`Outdated: superseded by ${replacedBy} (${titles[replacedBy] ?? replacedBy})`);
  else if (factors.current === 0)
    reasons.push(`Outdated: last reviewed ${doc.date}, more than twice its ${doc.reviewIntervalMonths}-month review interval`);
  else if (factors.current !== null && factors.current < 1)
    reasons.push(`Review overdue: last reviewed ${doc.date}, review interval ${doc.reviewIntervalMonths} months`);
  if (doc.review === "outdated") reasons.push(`Owner confirmed this is outdated`);
  if (doc.review === "correct") reasons.push(`Owner confirmed this is correct${doc.basis ? `, based on: ${doc.basis}` : ""}`);
  if (openReports.length)
    reasons.push(`Reported by users ${openReports.length} time${openReports.length > 1 ? "s" : ""} (${openReports.map((r) => r.reason).join(", ")})`);
  for (const id of conflictsWith) reasons.push(`Contradicted by ${id} (${titles[id] ?? id})`);
  if (ownerless) reasons.push("No owner: nobody is accountable for keeping this correct");
  if (factors.appliesHere === 0.5) reasons.push(`Written for ${doc.clientType} clients, not ${client.clientType}`);
  if (track.count > 0)
    reasons.push(`${track.count} solved case${track.count > 1 ? "s" : ""} for ${client.country} ${client.clientType} clients`);
  const weakest = weakestFactor(factors, weights);
  const weakestValue = factors[weakest] === null ? "unknown" : round(factors[weakest]);
  reasons.push(`Weakest factor: ${FACTOR_LABELS[weakest]} (${weakestValue})`);
  reasons.push(`Who can help: ${doc.ownerRole ?? helpRole}`);

  return {
    factors: Object.fromEntries(Object.entries(factors).map(([k, v]) => [k, round(v)])),
    weights,
    total,
    status,
    reasons,
  };
}
