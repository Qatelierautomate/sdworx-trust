// Scenarios 2, 6 and 8 from the plan.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { reset, state } from "../src/data.js";
import { search } from "../src/search.js";
import { recordSolved, approveProposal, requestAccess, patchDocument } from "../src/workflow.js";

beforeEach(reset);

const retro = { question: "Can we correct a closed pay run retroactively?", clientId: "CL2", role: "all-consultants" };
const salary = { question: "How do we handle a mid-month salary change?", clientId: "CL1", role: "all-consultants" };
const ranking = (s) => s.results.map((r) => `${r.docId}:${r.trust?.total}`);

test("scenario 2: a solved case lifts the document above the policy, only in its scope", async () => {
  assert.deepEqual(ranking(await search(retro)), ["D11:0.8", "D12:0.74"]);
  const beforeBE = ranking(await search(salary));

  const solved = await recordSolved({ ...retro, docId: "D12", outcome: "Sent the template, client agreed." });
  assert.equal(solved.case.id, "C14");
  assert.deepEqual(solved.case.scope, { country: "FR", clientType: "mid-size" });
  assert.deepEqual(ranking(solved.search), ["D12:0.81", "D11:0.8"]);
  assert.equal(solved.proposal.ownerRole, "Payroll France client team");

  assert.deepEqual(ranking(await search(salary)), beforeBE);
});

test("scenario 2: only the owner can approve, and approval is audited", async () => {
  const { proposal } = await recordSolved({ ...retro, docId: "D12" });
  assert.throws(() => approveProposal(proposal.id, { role: "all-consultants", decision: "approve" }), { status: 403 });

  const { auditEntry } = approveProposal(proposal.id, { role: "Payroll France client team", decision: "approve" });
  assert.equal(auditEntry.action, "approve-update");
  assert.equal(auditEntry.before.date, "2026-02-03");
  assert.equal(auditEntry.after.date, "2026-09-30");
  assert.match(auditEntry.after.snippet, /Confirmed by solved case C14 \(FR, mid-size\)/);
  assert.deepEqual(state.audit.map((a) => a.action), ["approve-update", "solved-case"]);
  assert.throws(() => approveProposal(proposal.id, { role: "Payroll France client team", decision: "approve" }), { status: 409 });
});

test("a solved case on an ownerless document is routed to the country policy owner", async () => {
  const { proposal } = await recordSolved({ ...salary, docId: "D05" });
  assert.equal(proposal.ownerRole, "Payroll Belgium policy owner");
  assert.match(proposal.note, /no owner/);
});

test("consultants cannot mark a restricted document solved, but can request access", async () => {
  await assert.rejects(recordSolved({ ...salary, docId: "D07" }), { status: 403 });
  const { auditEntry, message } = requestAccess({ docId: "D07", role: "all-consultants" });
  assert.equal(auditEntry.action, "request-access");
  assert.equal(message, "Request sent to Alpine Logistics account lead");
});

test("scenario 6: removing the owner or ageing the date changes trust and rank", async () => {
  patchDocument("D01", { ownerRole: null });
  const s = await search(salary);
  assert.deepEqual(ranking(s).slice(0, 2), ["D04:0.79", "D01:0.77"]);
  assert.equal(state.audit[0].action, "edit-document");

  patchDocument("D01", { date: "2024-06-01" });
  assert.equal((await search(salary)).results.find((r) => r.docId === "D01").status, "outdated");
});

test("scenario 8: reset restores fixtures and clears demo activity", async () => {
  await recordSolved({ ...retro, docId: "D12" });
  patchDocument("D01", { ownerRole: null });
  reset();
  assert.equal(state.cases.length, 13);
  assert.deepEqual(state.proposals, []);
  assert.deepEqual(state.audit, []);
  assert.equal(state.documents[0].ownerRole, "Payroll Belgium policy owner");
});

test("reports: small penalty, one per role, only the owner decides", async () => {
  const { reportDocument, ownerInbox, reviewReport } = await import("../src/workflow.js");
  const top = async () => (await search(salary)).results.find((r) => r.docId === "D04").trust.total;
  assert.equal(await top(), 0.79);

  const report = reportDocument({ docId: "D04", role: "all-consultants", reason: "outdated" });
  assert.equal(await top(), 0.74);
  assert.throws(() => reportDocument({ docId: "D04", role: "all-consultants", reason: "wrong" }), { status: 409 });
  assert.throws(() => reportDocument({ docId: "D07", role: "all-consultants", reason: "wrong" }), { status: 403 });

  assert.deepEqual(ownerInbox("Payroll Belgium mid-size team").map((r) => r.id), [report.id]);
  assert.deepEqual(ownerInbox("all-consultants"), []);
  assert.throws(() => reviewReport(report.id, { role: "all-consultants", decision: "reject" }), { status: 403 });

  reviewReport(report.id, { role: "Payroll Belgium mid-size team", decision: "confirm-outdated" });
  assert.equal((await search(salary)).results.some((r) => r.docId === "D04"), false);
});

test("reports: a rejected report removes the penalty, a confirmed-correct document gets a floor", async () => {
  const { reportDocument, reviewReport } = await import("../src/workflow.js");
  const trustOf = async (id) => (await search(salary)).results.find((r) => r.docId === id).trust.total;
  const r1 = reportDocument({ docId: "D04", role: "all-consultants", reason: "wrong" });
  reviewReport(r1.id, { role: "Payroll Belgium mid-size team", decision: "reject" });
  assert.equal(await trustOf("D04"), 0.79);

  const r2 = reportDocument({ docId: "D01", role: "all-consultants", reason: "wrong" });
  reviewReport(r2.id, { role: "Payroll Belgium policy owner", decision: "confirm-correct" });
  assert.equal(await trustOf("D01"), 0.92);
  assert.deepEqual(state.audit.map((a) => a.action).slice(0, 2), ["review-report", "report-document"]);
});

test("conflict loop: escalate with evidence, owner doesn't know, legal decides, answer becomes verified", async () => {
  const { escalateConflict, conflictInbox, resolveConflict } = await import("../src/workflow.js");
  const q = { question: "Can we correct a closed pay run retroactively?", clientId: "CL1", role: "all-consultants" };
  const before = await search(q);
  assert.equal(before.confidence.label, "conflicting");
  assert.deepEqual(before.confidence.docIds, ["D08", "D09"]);

  const conflict = escalateConflict({ docIds: before.confidence.docIds, role: "all-consultants", question: q.question });
  assert.deepEqual(conflict.assignedTo, ["Payroll Belgium policy owner", "Payroll Belgium mid-size team"]);
  const [item] = conflictInbox("Payroll Belgium mid-size team");
  assert.equal(item.evidence.length, 2);
  assert.equal(item.evidence[0].solvedCases.length, 2);
  assert.match((await search(q)).confidence.note, /Escalated to .* not resolved yet/);

  assert.throws(() => resolveConflict(conflict.id, { role: "all-consultants", decision: "escalate", escalateTo: "x" }), { status: 403 });
  resolveConflict(conflict.id, { role: "Payroll Belgium mid-size team", decision: "escalate", escalateTo: "Legal Belgium" });
  assert.throws(() => resolveConflict(conflict.id, { role: "Legal Belgium", decision: "keep", keepDocId: "D08" }), { status: 400 });
  resolveConflict(conflict.id, { role: "Legal Belgium", decision: "keep", keepDocId: "D08", basis: "Payroll correction instruction, July 2026" });

  const after = await search(q);
  assert.equal(after.confidence.label, "verified");
  assert.equal(after.results[0].docId, "D08");
  assert.ok(after.results[0].reasons.includes("Owner confirmed this is correct, based on: Payroll correction instruction, July 2026"));
  assert.equal(after.results.some((r) => r.docId === "D09"), false);
  assert.deepEqual(state.audit.map((a) => a.action).slice(0, 3), ["conflict-keep", "conflict-escalate", "escalate-conflict"]);
});
