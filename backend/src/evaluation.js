// Known-answer questions: is the top result the right document, with trust off versus on?
// `expected: null` means the right answer is "nothing reliable for this client".
import { search } from "./search.js";

export const QUESTIONS = [
  { clientId: "CL1", question: "How do we handle a mid-month salary change?", expected: "D01" },
  { clientId: "CL1", question: "Can I backdate a pay rise?", expected: "D01" },
  { clientId: "CL1", question: "An employee got a raise halfway through the month, how do I pay it?", expected: "D01" },
  { clientId: "CL1", question: "What do I need to know to take over this client?", expected: "D20" },
  { clientId: "CL1", question: "What is the sick leave reporting deadline?", expected: "D13" },
  { clientId: "CL2", question: "Can we correct a closed pay run retroactively?", expected: "D11" },
  { clientId: "CL2", question: "We made a mistake in last month's payroll, can we fix it?", expected: "D11" },
  { clientId: "CL2", question: "What is the sick leave reporting deadline?", expected: "D14" },
  { clientId: "CL2", question: "How many days do we have to report an employee being sick?", expected: "D14" },
  { clientId: "CL3", question: "How do we run payroll for a cross-border employee?", expected: "D18" },
  { clientId: "CL3", question: "Employee lives in Belgium but works in the Netherlands", expected: "D18" },
  { clientId: "CL3", question: "What are the year-end closing dates?", expected: null },
];

export async function evaluate() {
  const rows = [];
  for (const q of QUESTIONS) {
    const answer = async (trust) => {
      const s = await search({ ...q, role: "all-consultants", trust });
      return s.results.find((r) => !r.locked)?.docId ?? null;
    };
    const plain = await answer(false);
    const trusted = await answer(true);
    rows.push({ ...q, plain, trusted, plainCorrect: plain === q.expected, trustedCorrect: trusted === q.expected });
  }
  return {
    total: rows.length,
    plainCorrect: rows.filter((r) => r.plainCorrect).length,
    trustedCorrect: rows.filter((r) => r.trustedCorrect).length,
    rows,
  };
}
