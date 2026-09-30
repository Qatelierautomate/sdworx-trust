// POST /api/search: access filter, relevance, country gate, trust scoring, conflicts, sort.
import { state, DEMO_NOW, HttpError, resolveClient, countryPolicyOwner, roles, canSee } from "./data.js";
import { rankRelevance, MIN_SHARE_OF_BEST } from "./relevance.js";
import { scoreDocument, supersededBy, appliesToCountry } from "./scoring.js";
import { explain } from "./explain.js";

const round = (n) => Math.round(n * 100) / 100;

const contradicts = (a, b) => a.contradicts.includes(b.id) || b.contradicts.includes(a.id);

// A contradiction only makes the answer "Conflicting" when the other side is nearly as trusted.
const CONFLICT_MARGIN = 0.1;

function confidenceLabel(top, results) {
  if (!top) return { label: "unknown", note: "No reliable document found for this client." };
  const rivals = results.filter((r) => top.conflictsWith.includes(r.docId));
  const close = rivals.find((r) => top.trust.total - r.trust.total <= CONFLICT_MARGIN);
  if (close) {
    const docIds = [top.docId, close.docId];
    const open = state.conflicts.find((c) => c.status !== "resolved" && docIds.every((id) => c.docIds.includes(id)));
    const note = open
      ? `${close.docId} says otherwise with similar trust. Escalated to ${open.assignedTo.join(" and ")} on ${open.openedOn}, not resolved yet. Don't act on either without checking.`
      : `${close.docId} says otherwise with similar trust. Don't act until an owner confirms. Ask ${[top.ownerRole, close.ownerRole].filter(Boolean).join(" or ")}.`;
    return { label: "conflicting", docIds, conflictId: open?.id ?? null, note };
  }
  const note = rivals.length
    ? `${rivals.map((r) => r.docId).join(", ")} says otherwise but has much lower trust (${rivals.map((r) => r.trust.total).join(", ")}).`
    : null;
  const official = top.sourceType === "policy" && top.trust.factors.current === 1 && top.trust.factors.owned === 1;
  return official ? { label: "verified", note } : { label: "likely", note: note ?? "Best available source, but not an official current policy." };
}

// trust: false is the "plain search" baseline for the demo: keyword match, newest first,
// no trust ranking and no country gate. Access control still applies.
export async function search({ question, clientId, country, customerType, role = "all-consultants", trust = true }) {
  const client = resolveClient({ clientId, country, customerType });
  if (!question?.trim()) {
    throw new HttpError(400, { error: "empty", examples: client.sampleQuestions });
  }
  if (!roles().includes(role)) throw new HttpError(400, { error: `Unknown role ${role}`, roles: roles() });

  const relevance = rankRelevance(question, state.documents);
  const matches = state.documents.map((doc) => ({ doc, ...relevance.get(doc.id) }));

  const visible = [];
  const locked = [];
  const appliesElsewhere = [];
  for (const { doc, relevance, matched } of matches) {
    if (relevance < MIN_SHARE_OF_BEST) continue;
    if (trust && doc.review === "outdated") continue; // the owner took it out of answers
    const allowed = canSee(doc, role);
    if (trust && !appliesToCountry(doc, client)) {
      appliesElsewhere.push(
        allowed
          ? { docId: doc.id, title: doc.title, country: doc.country, ownerRole: doc.ownerRole }
          : { docId: doc.id, country: doc.country, ownerRole: doc.ownerRole, locked: true },
      );
    } else if (!allowed) {
      locked.push({
        docId: doc.id,
        locked: true,
        status: "locked",
        ownerRole: doc.ownerRole,
        reasons: [`Restricted for your role. Request access from ${doc.ownerRole}`],
      });
    } else {
      visible.push({ doc, relevance, matched });
    }
  }

  const titles = Object.fromEntries(visible.map(({ doc }) => [doc.id, doc.title]));
  const ctx = {
    client,
    cases: state.cases,
    weights: state.weights,
    now: DEMO_NOW,
    supersededMap: supersededBy(state.documents),
    titles,
    helpRole: countryPolicyOwner(client.country),
    reports: state.reports,
  };

  const results = visible
    .map(({ doc, relevance, matched }) => {
      const conflictsWith = visible.filter((o) => o.doc !== doc && contradicts(doc, o.doc)).map((o) => o.doc.id);
      const { factors, weights, total, status, reasons } = scoreDocument(doc, { ...ctx, conflictsWith });
      return {
        docId: doc.id,
        title: doc.title,
        snippet: doc.snippet,
        sourceType: doc.sourceType,
        date: doc.date,
        ownerRole: doc.ownerRole,
        country: doc.country,
        clientType: doc.clientType,
        relevance,
        matchedKeywords: matched,
        trust: { total, factors, weights },
        status,
        reasons,
        conflictsWith,
        locked: false,
      };
    })
    .sort(trust
      ? (a, b) => b.trust.total - a.trust.total || b.relevance - a.relevance
      : (a, b) => Math.round(b.relevance * 10) - Math.round(a.relevance * 10) || b.date.localeCompare(a.date))
    .map((r) => ({ ...r, relevance: round(r.relevance), trust: { ...r.trust, total: round(r.trust.total) } }));

  const conflicts = [];
  for (const r of results) {
    for (const other of r.conflictsWith) {
      if (!conflicts.some((c) => c.docIds.includes(r.docId) && c.docIds.includes(other))) {
        conflicts.push({ docIds: [r.docId, other], note: `${titles[r.docId]} and ${titles[other]} disagree` });
      }
    }
  }

  return {
    client,
    question,
    role,
    trust,
    confidence: trust ? confidenceLabel(results[0], results) : null,
    results: [...results, ...locked],
    appliesElsewhere,
    conflicts,
    nothingReliable:
      results.length === 0
        ? { askRole: countryPolicyOwner(client.country), appliesElsewhereCount: appliesElsewhere.length }
        : null,
    explanation: trust && results.length ? await explain(results[0], { client, results }) : null,
  };
}
