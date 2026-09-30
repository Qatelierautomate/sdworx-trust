// Explanation of the top result. The template is built from the factor values and always works.
// Gemini may only rewrite it into plainer language; any number, date or id it adds is rejected.
import { geminiRewrite } from "./gemini.js";

const cache = new Map();

export function templateExplain(result, { client }) {
  const intro =
    `"${result.title}" is the most trustworthy match for ${client.name} ` +
    `(${client.country}, ${client.clientType}), with trust ${result.trust.total} out of 1.`;
  const warning =
    result.status === "conflict"
      ? " Do not act on it until the owner confirms which source is right."
      : result.status === "outdated"
        ? " Treat it with care: it is outdated."
        : "";
  return `${intro} ${result.reasons.join(". ")}.${warning}`;
}

const FACT_PATTERN = /\d{4}-\d{2}-\d{2}|\b[DCPA]\d+\b|\d+(?:\.\d+)?/g;

// Every date, id and number in the rewrite must already appear in the template.
export function checkFacts(text, template) {
  const allowed = new Set(template.match(FACT_PATTERN) ?? []);
  return (text.match(FACT_PATTERN) ?? []).every((fact) => allowed.has(fact));
}

const prompt = (template) =>
  "Rewrite this explanation for a payroll consultant in plain, friendly language, at most 3 short sentences. " +
  "Use only the facts given. Do not add or change any number, date or document id. " +
  "Keep the warning and who can help.\n\n" +
  template;

export async function explain(result, context, rewrite = geminiRewrite) {
  const template = templateExplain(result, context);
  const key = `${context.client.id}:${template}`;
  if (cache.has(key)) return cache.get(key);

  const text = await rewrite(prompt(template));
  if (text && checkFacts(text, template)) {
    const explanation = { text, source: "gemini" };
    cache.set(key, explanation);
    return explanation;
  }
  return { text: template, source: "template" };
}
