// Prints the evaluation for the pitch: npm run eval
import { evaluate } from "./src/evaluation.js";

const result = await evaluate();
for (const r of result.rows) {
  const mark = (ok) => (ok ? "ok " : "NO ");
  console.log(`${r.clientId}  plain ${mark(r.plainCorrect)}${String(r.plain).padEnd(5)} trust ${mark(r.trustedCorrect)}${String(r.trusted).padEnd(5)} ${r.question}`);
}
console.log(`\nPlain search: ${result.plainCorrect}/${result.total} correct. Trust ranking: ${result.trustedCorrect}/${result.total} correct.`);
