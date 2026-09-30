// Scenarios 1, 3, 4 and 5 from the plan, against the real fixtures.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { reset } from "../src/data.js";
import { search } from "../src/search.js";

beforeEach(reset);

const ids = (s) => s.results.map((r) => r.docId);
const byId = (s, id) => s.results.find((r) => r.docId === id);

test("scenario 1: salary change for a BE mid-size client ranks by trust and flags the conflict", async () => {
  const s = await search({ question: "How do we handle a mid-month salary change?", clientId: "CL1", role: "all-consultants" });
  assert.deepEqual(ids(s), ["D01", "D04", "D05", "D06", "D02", "D07"]);
  assert.deepEqual(s.results.map((r) => r.trust?.total), [0.92, 0.79, 0.59, 0.51, 0.2, undefined]);
  assert.deepEqual(s.results.map((r) => r.status), ["conflict", "ok", "ownerless", "conflict", "outdated", "locked"]);
  assert.deepEqual(s.appliesElsewhere.map((d) => d.docId), ["D03"]);
  assert.deepEqual(s.conflicts.map((c) => c.docIds), [["D01", "D06"]]);
  assert.match(s.explanation.text, /Contradicted by D06/);
  assert.equal(s.explanation.source, "template");
});

test("locked documents reveal only that they exist and who owns them", async () => {
  const s = await search({ question: "How do we handle a mid-month salary change?", clientId: "CL1", role: "all-consultants" });
  assert.deepEqual(Object.keys(byId(s, "D07")).sort(), ["docId", "locked", "ownerRole", "reasons", "status"]);
  assert.equal(byId(s, "D07").ownerRole, "Alpine Logistics account lead");
});

test("scenario 3: the handover document is locked for consultants and visible to the key-account team", async () => {
  const q = { question: "What do I need to know to take over this client?", clientId: "CL1" };
  const consultant = await search({ ...q, role: "all-consultants" });
  assert.deepEqual(ids(consultant), ["D20", "D22", "D21"]);
  assert.equal(byId(consultant, "D21").locked, true);
  assert.equal(byId(consultant, "D22").status, "outdated");

  const keyAccount = await search({ ...q, role: "key-account-team" });
  assert.deepEqual(ids(keyAccount), ["D20", "D21", "D22"]);
  assert.equal(byId(keyAccount, "D21").trust.total, 0.74);
});

test("scenario 4: documents for another country are listed as applies elsewhere, not ranked", async () => {
  const s = await search({ question: "What is the sick leave reporting deadline?", clientId: "CL2", role: "all-consultants" });
  assert.deepEqual(ids(s), ["D14"]);
  assert.deepEqual(s.appliesElsewhere.map((d) => d.docId), ["D13", "D15", "D16"]);
});

test("scenario 5: a gap names who to ask", async () => {
  const s = await search({ question: "What are the year-end closing dates?", clientId: "CL3", role: "all-consultants" });
  assert.deepEqual(s.results, []);
  assert.deepEqual(s.nothingReliable, { askRole: "Payroll Netherlands policy owner", appliesElsewhereCount: 3 });
  assert.equal(s.explanation, null);
});

test("an empty question returns example questions", async () => {
  await assert.rejects(search({ question: "  ", clientId: "CL3", role: "all-consultants" }), (err) => {
    assert.equal(err.status, 400);
    assert.equal(err.body.examples.length, 2);
    return true;
  });
});

test("every sample question returns something to show", async () => {
  for (const clientId of ["CL1", "CL2", "CL3"]) {
    const { client } = await search({ question: "x", clientId, role: "all-consultants" });
    for (const question of client.sampleQuestions) {
      const s = await search({ question, clientId, role: "all-consultants" });
      assert.ok(s.results.length || s.nothingReliable, `${clientId}: ${question}`);
    }
  }
});

test("free-form questions find the right documents", async () => {
  const top = async (question, clientId) =>
    (await search({ question, clientId, role: "all-consultants" })).results[0]?.docId ?? "none";
  assert.equal(await top("An employee got a raise halfway through the month, how do I pay it?", "CL1"), "D01");
  assert.equal(await top("I'm taking over Alpine, what should I know?", "CL1"), "D20");
  assert.equal(await top("We made a mistake in last month's payroll, can we fix it?", "CL2"), "D11");
  assert.equal(await top("How many days do we have to report an employee being sick?", "CL2"), "D14");
  assert.equal(await top("Employee lives in Belgium but works in the Netherlands", "CL3"), "D18");
  assert.equal(await top("What is the capital of France?", "CL1"), "none");
});

test("trust toggle: plain search puts the Teams chat first, trust ranking the verified policy", async () => {
  const q = { question: "How do we handle a mid-month salary change?", clientId: "CL1", role: "all-consultants" };
  const plain = await search({ ...q, trust: false });
  assert.equal(plain.results[0].docId, "D06");
  assert.equal(plain.confidence, null);
  const trusted = await search(q);
  assert.equal(trusted.results[0].docId, "D01");
  assert.equal(trusted.confidence.label, "verified");
  assert.match(trusted.confidence.note, /D06 says otherwise but has much lower trust/);
});

test("confidence labels: unknown when nothing applies, likely for a non-policy top result", async () => {
  const gap = await search({ question: "What are the year-end closing dates?", clientId: "CL3", role: "all-consultants" });
  assert.equal(gap.confidence.label, "unknown");
  const expert = await search({ question: "Who do I ask about cross-border escalation?", clientId: "CL3", role: "all-consultants" });
  assert.equal(expert.results[0].docId, "D19");
  assert.equal(expert.confidence.label, "likely");
});

test("evaluation: trust ranking answers every demo question correctly, plain search does not", async () => {
  const { evaluate } = await import("../src/evaluation.js");
  const result = await evaluate();
  assert.equal(result.trustedCorrect, result.total);
  assert.ok(result.plainCorrect < result.total / 2);
});
