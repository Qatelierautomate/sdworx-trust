// Deterministic relevance, no AI: synonyms from payroll vocabulary, then word matching over
// keywords, title and text, with rare words counting more than common ones. Works offline.

// Everyday phrasings mapped to the vocabulary the documents use.
const SYNONYMS = [
  [/\b(take over|taking over|takeover|took over|inherit\w*|new client|new portfolio|hand over|handing over)\b/g, " handover portfolio "],
  [/\b(raise|rise|increase|increased|raised|pay rise|pay increase|salary change|new salary|promotion)\b/g, " salary change "],
  [/\b(halfway|middle|mid)\b/g, " mid month "],
  [/\b(backdate\w*|retro\w*|last month|previous month|already paid|after (the )?(payroll )?clos\w*|closed|payroll clos\w*)\b/g, " retroactive correction closed "],
  [/\b(mistake|error|wrong|fix|correct|adjust\w*|amend\w*)\b/g, " correction "],
  [/\b(sick|ill|illness|sickness|off work|medical)\b/g, " sick leave absence "],
  [/\b(report|notify|declare|inform|deadline|how many days|how long|time limit)\b/g, " reporting deadline "],
  [/\b(abroad|foreign|cross border|lives in|works in|another country|two countries|commut\w*)\b/g, " cross-border tax residence "],
  [/\b(year end|yearend|end of year|end of the year|december|cut off|cutoff|closing date\w*|closing calendar)\b/g, " year-end closing cut-off "],
  [/\b(who (do|should|can) i ask|expert|escalat\w*|contact)\b/g, " escalation expert "],
];

const STOP = new Set(
  ("a an the and or but of to in on at for with by from is are was were be been do does did can could " +
    "should would will i we you he she it they my our your this that these those what which who how when where " +
    "why there here have has had not no me us them about into than then so if as just also any all some " +
    "more most very get got make made need know handle deal work payroll employee employees client clients " +
    "company person someone people our their it's i'm im do").split(" "),
);

// Lowercase, strip accents, split into words, drop filler words, and stem to 5 letters
// so "corrections" matches "correction".
const stem = (w) => (w.length >= 5 ? w.slice(0, 5) : w);
export const tokenize = (text) =>
  (text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((w) => !STOP.has(w))
    .map(stem);

const expand = (question) => SYNONYMS.reduce((q, [pattern, add]) => q.replace(pattern, (m) => `${m} ${add}`), question.toLowerCase());

const FIELD_WEIGHT = { keywords: 3, title: 2, snippet: 1 };

function indexDocument(doc) {
  const index = new Map();
  const add = (text, weight) => {
    for (const t of tokenize(text)) index.set(t, Math.max(index.get(t) ?? 0, weight));
  };
  add(doc.snippet, FIELD_WEIGHT.snippet);
  add(doc.title, FIELD_WEIGHT.title);
  add(doc.keywords.join(" "), FIELD_WEIGHT.keywords);
  return index;
}

// Keep documents at least half as relevant as the best match.
export const MIN_SHARE_OF_BEST = 0.5;

// Returns Map docId -> { relevance (0..1, relative to the best match), matched keywords }.
export function rankRelevance(question, documents) {
  const terms = [...new Set(tokenize(expand(question)))];
  const indexes = documents.map((doc) => ({ doc, index: indexDocument(doc) }));
  const df = (t) => indexes.filter(({ index }) => index.has(t)).length;
  const idf = Object.fromEntries(terms.map((t) => [t, Math.log(1 + documents.length / Math.max(1, df(t)))]));

  const scored = indexes.map(({ doc, index }) => {
    // Only a keyword or title hit makes a document eligible; text hits only add to the score.
    const strongHit = terms.some((t) => (index.get(t) ?? 0) >= FIELD_WEIGHT.title);
    const score = strongHit ? terms.reduce((sum, t) => sum + (index.get(t) ?? 0) * idf[t], 0) : 0;
    const matched = doc.keywords.filter((k) => tokenize(k).some((t) => terms.includes(t)));
    return { doc, score, matched };
  });

  const best = Math.max(0, ...scored.map((s) => s.score));
  return new Map(
    scored.map(({ doc, score, matched }) => [doc.id, { relevance: best ? score / best : 0, matched }]),
  );
}
