// Step 3 of the demo: solved cases, owner approval, access requests, metadata edits, audit log.
import { state, today, HttpError, findClient, findDocument, countryPolicyOwner, canSee } from "./data.js";
import { search } from "./search.js";

export function audit({ actorRole, action, target, before = null, after = null }) {
  const entry = { id: `A${state.audit.length + 1}`, at: new Date().toISOString(), actorRole, action, target, before, after };
  state.audit.unshift(entry);
  return entry;
}

const requireAccess = (doc, role) => {
  if (!canSee(doc, role)) throw new HttpError(403, { error: `Role ${role} cannot see ${doc.id}` });
};

// Recorded straight away (the consultant confirms the outcome), scoped to this client's country
// and client type. The documentation change itself waits for the owner's approval.
export async function recordSolved({ docId, clientId, role, question, outcome }) {
  const doc = findDocument(docId);
  const client = findClient(clientId);
  requireAccess(doc, role);

  const solvedCase = {
    id: `C${String(state.cases.length + 1).padStart(2, "0")}`,
    documentId: doc.id,
    scope: { country: client.country, clientType: client.clientType },
    date: today(),
    outcome: outcome || "Confirmed solved by the consultant.",
  };
  state.cases.push(solvedCase);

  const ownerRole = doc.ownerRole ?? countryPolicyOwner(client.country);
  const proposal = {
    id: `P${state.proposals.length + 1}`,
    docId: doc.id,
    caseId: solvedCase.id,
    ownerRole,
    change: `Add confirmed case ${solvedCase.id} (${client.country}, ${client.clientType}) and mark as reviewed ${today()}`,
    note: doc.ownerRole ? null : `${doc.id} has no owner, so this was routed to ${ownerRole}`,
    requestedBy: role,
    status: "pending",
  };
  state.proposals.push(proposal);
  audit({ actorRole: role, action: "solved-case", target: doc.id, after: solvedCase });

  return {
    case: solvedCase,
    proposal,
    search: question ? await search({ question, clientId, role }) : null,
  };
}

export function approveProposal(id, { role, decision }) {
  const proposal = state.proposals.find((p) => p.id === id);
  if (!proposal) throw new HttpError(404, { error: `Unknown proposal ${id}` });
  if (proposal.status !== "pending") throw new HttpError(409, { error: `Proposal ${id} is already ${proposal.status}` });
  if (role !== proposal.ownerRole) throw new HttpError(403, { error: `Only ${proposal.ownerRole} can decide on ${id}` });
  if (decision !== "approve" && decision !== "reject") throw new HttpError(400, { error: "decision must be approve or reject" });

  const doc = findDocument(proposal.docId);
  const solvedCase = state.cases.find((c) => c.id === proposal.caseId);
  if (decision === "reject") {
    proposal.status = "rejected";
    return { proposal, auditEntry: audit({ actorRole: role, action: "reject-update", target: doc.id, after: proposal }) };
  }

  const before = { date: doc.date, snippet: doc.snippet };
  doc.date = today();
  doc.snippet += ` Confirmed by solved case ${solvedCase.id} (${solvedCase.scope.country}, ${solvedCase.scope.clientType}).`;
  proposal.status = "approved";
  const auditEntry = audit({
    actorRole: role,
    action: "approve-update",
    target: doc.id,
    before,
    after: { date: doc.date, snippet: doc.snippet },
  });
  return { proposal, auditEntry };
}

export function requestAccess({ docId, role }) {
  const doc = findDocument(docId);
  if (canSee(doc, role)) throw new HttpError(409, { error: `Role ${role} already has access to ${docId}` });
  const auditEntry = audit({ actorRole: role, action: "request-access", target: doc.id });
  return { auditEntry, message: `Request sent to ${doc.ownerRole}` };
}

// Demo control for the acceptance check "changing a date or owner visibly changes trust and rank".
export function patchDocument(id, changes, role) {
  const doc = findDocument(id);
  const before = {};
  const after = {};
  for (const field of ["date", "ownerRole"]) {
    if (!(field in changes)) continue;
    if (field === "date" && Number.isNaN(Date.parse(changes.date))) throw new HttpError(400, { error: "Invalid date" });
    before[field] = doc[field];
    after[field] = doc[field] = changes[field];
  }
  if (!Object.keys(after).length) throw new HttpError(400, { error: "Only date and ownerRole can be changed" });
  audit({ actorRole: role ?? "demo-admin", action: "edit-document", target: id, before, after });
  return doc;
}

const REPORT_REASONS = ["outdated", "wrong", "wrong-country"];

// Anyone who can see a document can report it once. The owner decides what happens.
export function reportDocument({ docId, role, reason }) {
  const doc = findDocument(docId);
  requireAccess(doc, role);
  if (!REPORT_REASONS.includes(reason)) throw new HttpError(400, { error: `reason must be one of ${REPORT_REASONS.join(", ")}` });
  if (state.reports.some((r) => r.docId === docId && r.role === role))
    throw new HttpError(409, { error: `Role ${role} already reported ${docId}` });

  const report = {
    id: `R${state.reports.length + 1}`,
    docId,
    role,
    reason,
    ownerRole: doc.ownerRole ?? countryPolicyOwner(doc.country),
    status: "open",
  };
  state.reports.push(report);
  audit({ actorRole: role, action: "report-document", target: docId, after: report });
  return report;
}

export const ownerInbox = (role) => state.reports.filter((r) => r.ownerRole === role);

const REVIEW_DECISIONS = { "confirm-outdated": "outdated", "confirm-correct": "correct", reject: null };

export function reviewReport(id, { role, decision }) {
  const report = state.reports.find((r) => r.id === id);
  if (!report) throw new HttpError(404, { error: `Unknown report ${id}` });
  if (report.status !== "open") throw new HttpError(409, { error: `Report ${id} is already ${report.status}` });
  if (role !== report.ownerRole) throw new HttpError(403, { error: `Only ${report.ownerRole} can review ${id}` });
  if (!(decision in REVIEW_DECISIONS)) throw new HttpError(400, { error: `decision must be one of ${Object.keys(REVIEW_DECISIONS).join(", ")}` });

  const doc = findDocument(report.docId);
  const before = { review: doc.review ?? null };
  if (decision === "reject") report.status = "rejected";
  else {
    report.status = decision;
    doc.review = REVIEW_DECISIONS[decision];
  }
  const auditEntry = audit({ actorRole: role, action: "review-report", target: doc.id, before, after: { decision, review: doc.review ?? null } });
  return { report, auditEntry };
}

// Conflicts: escalated to the owners of both documents with an evidence pack. They keep one
// (citing the source they checked), split the scope, or pass it up when they don't know.
function evidence(doc) {
  return {
    docId: doc.id,
    title: doc.title,
    snippet: doc.snippet,
    sourceType: doc.sourceType,
    date: doc.date,
    ownerRole: doc.ownerRole,
    country: doc.country,
    clientType: doc.clientType,
    solvedCases: state.cases.filter((c) => c.documentId === doc.id),
    reports: state.reports.filter((r) => r.docId === doc.id),
  };
}

export function escalateConflict({ docIds, role, question }) {
  if (!Array.isArray(docIds) || docIds.length !== 2) throw new HttpError(400, { error: "docIds must list the 2 conflicting documents" });
  const docs = docIds.map(findDocument);
  docs.forEach((d) => requireAccess(d, role));
  if (!docs[0].contradicts.includes(docs[1].id) && !docs[1].contradicts.includes(docs[0].id))
    throw new HttpError(400, { error: `${docIds.join(" and ")} are not marked as conflicting` });
  const existing = state.conflicts.find((c) => c.status !== "resolved" && docIds.every((id) => c.docIds.includes(id)));
  if (existing) return existing;

  const conflict = {
    id: `K${state.conflicts.length + 1}`,
    docIds,
    question: question ?? null,
    raisedBy: role,
    openedOn: today(),
    assignedTo: [...new Set(docs.map((d) => d.ownerRole ?? countryPolicyOwner(d.country)))],
    status: "open",
    history: [],
  };
  state.conflicts.push(conflict);
  audit({ actorRole: role, action: "escalate-conflict", target: docIds.join("+"), after: { id: conflict.id, assignedTo: conflict.assignedTo } });
  return conflict;
}

export const conflictInbox = (role) =>
  state.conflicts
    .filter((c) => c.assignedTo.includes(role) && c.status !== "resolved")
    .map((c) => ({ ...c, evidence: c.docIds.map((id) => evidence(findDocument(id))) }));

const unlink = (a, b) => {
  a.contradicts = a.contradicts.filter((id) => id !== b.id);
  b.contradicts = b.contradicts.filter((id) => id !== a.id);
};

export function resolveConflict(id, { role, decision, keepDocId, basis, escalateTo }) {
  const conflict = state.conflicts.find((c) => c.id === id);
  if (!conflict) throw new HttpError(404, { error: `Unknown conflict ${id}` });
  if (conflict.status === "resolved") throw new HttpError(409, { error: `Conflict ${id} is already resolved` });
  if (!conflict.assignedTo.includes(role)) throw new HttpError(403, { error: `Only ${conflict.assignedTo.join(" or ")} can resolve ${id}` });
  const [a, b] = conflict.docIds.map(findDocument);

  if (decision === "escalate") {
    if (!escalateTo) throw new HttpError(400, { error: "escalateTo is required" });
    conflict.history.push({ by: role, decision, to: escalateTo, on: today() });
    conflict.assignedTo = [escalateTo];
    conflict.status = "escalated";
  } else if (decision === "keep" || decision === "split-scope") {
    if (!basis?.trim()) throw new HttpError(400, { error: "basis is required: which law, agreement or contract did you check?" });
    if (decision === "keep") {
      const keep = [a, b].find((d) => d.id === keepDocId);
      if (!keep) throw new HttpError(400, { error: `keepDocId must be ${a.id} or ${b.id}` });
      const retire = keep === a ? b : a;
      keep.review = "correct";
      keep.basis = basis;
      retire.review = "outdated";
    } else {
      unlink(a, b); // both stay valid, each for its own scope
    }
    conflict.history.push({ by: role, decision, keepDocId: keepDocId ?? null, basis, on: today() });
    conflict.status = "resolved";
  } else {
    throw new HttpError(400, { error: "decision must be keep, split-scope or escalate" });
  }
  const auditEntry = audit({ actorRole: role, action: `conflict-${decision}`, target: conflict.docIds.join("+"), after: conflict.history.at(-1) });
  return { conflict, auditEntry };
}
