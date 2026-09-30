// Scenario 7: Gemini down or inventing facts always falls back to the template.
import { test } from "node:test";
import assert from "node:assert/strict";
import { explain, templateExplain, checkFacts } from "../src/explain.js";

const client = { id: "CL1", name: "Alpine Logistics", country: "BE", clientType: "mid-size" };
const result = {
  docId: "D01",
  title: "Procedure: mid-month salary change (BE)",
  status: "conflict",
  trust: { total: 0.92 },
  reasons: ["Contradicted by D06 (Teams thread)", "Weakest factor: track record (0.62)", "Who can help: Payroll Belgium policy owner"],
};

test("the template contains the score, the reasons and the warning", () => {
  const text = templateExplain(result, { client });
  assert.match(text, /trust 0\.92/);
  assert.match(text, /Contradicted by D06/);
  assert.match(text, /Do not act on it/);
});

test("no answer from Gemini gives the template", async () => {
  const e = await explain(result, { client }, async () => null);
  assert.equal(e.source, "template");
});

test("a rewrite that invents a number is rejected", async () => {
  const e = await explain(result, { client }, async () => "Trust is 0.95, go ahead. Ask the owner.");
  assert.equal(e.source, "template");
});

test("a faithful rewrite is used", async () => {
  const text = "This Belgian procedure is your best bet (trust 0.92), but D06 disagrees with it. Check with the Payroll Belgium policy owner first.";
  const e = await explain(result, { client }, async () => text);
  assert.deepEqual(e, { text, source: "gemini" });
});

test("fact check compares dates, ids and numbers", () => {
  assert.ok(checkFacts("Reviewed 2026-08-12, see D01.", "D01 reviewed 2026-08-12"));
  assert.ok(!checkFacts("Reviewed 2026-08-13.", "reviewed 2026-08-12"));
  assert.ok(!checkFacts("See D09.", "See D01."));
});
