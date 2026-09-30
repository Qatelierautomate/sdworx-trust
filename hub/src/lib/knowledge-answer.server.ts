// Answers come from the trust-ranking backend, not from an AI model. Every label, score and
// reason is computed from document metadata and confirmed cases, so it can be traced.
const BACKEND_URL = process.env["TRUST_BACKEND_URL"] ?? "https://sdworx-trust-b4kskswygq-uc.a.run.app";

export type KnowledgeAnswer = {
  answer: string;
  certainty: "verified" | "likely" | "conflicting" | "no_answer";
  confidence: number;
  reviewWarning: string;
  citedSourceIds: string[];
  reasons: string[];
};

type TrustResult = {
  docId: string;
  locked: boolean;
  title?: string;
  snippet?: string;
  sourceType?: string;
  date?: string;
  trust?: { total: number };
  reasons: string[];
};

type SearchResponse = {
  results: TrustResult[];
  confidence: { label: string; note: string | null; docIds?: string[] } | null;
  nothingReliable: { askRole: string } | null;
};

function toAnswer(s: SearchResponse): KnowledgeAnswer {
  const visible = s.results.filter((r) => !r.locked);
  const top = visible[0];
  if (!top) {
    const who = s.nothingReliable?.askRole ?? "the knowledge owner";
    return {
      answer: `No reliable document covers this question for this country and customer type. Ask ${who}.`,
      certainty: "no_answer",
      confidence: 0,
      reviewWarning: `Nothing to rely on yet. Ask ${who} before answering the customer.`,
      citedSourceIds: [],
      reasons: [`No reliable document found. Who can help: ${who}`],
    };
  }

  const label = s.confidence?.label;
  const certainty = label === "verified" || label === "likely" || label === "conflicting" ? label : "likely";
  let answer = `${top.snippet} (Source: ${top.title}, ${top.sourceType}, reviewed ${top.date}.)`;
  if (certainty === "conflicting") {
    const other = visible.find((r) => r.docId === s.confidence?.docIds?.[1]);
    if (other) answer = `Two sources disagree. "${top.title}" says: ${top.snippet} "${other.title}" says: ${other.snippet}`;
  }
  return {
    answer,
    certainty,
    confidence: Math.round((top.trust?.total ?? 0) * 100),
    reviewWarning: s.confidence?.note ?? "Check that this applies to the customer's period and contract before sending.",
    citedSourceIds: visible.slice(0, 3).map((r) => r.docId),
    reasons: top.reasons.slice(0, 4),
  };
}

export async function generateKnowledgeAnswer(input: {
  question: string;
  language: string;
  country: string;
  customerType: string;
  product: string;
}): Promise<{ data: KnowledgeAnswer | null; error: string | null }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: input.question,
        country: input.country,
        customerType: input.customerType,
        role: "all-consultants",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { data: null, error: body?.error ?? `The trust service answered with status ${res.status}.` };
    }
    return { data: toAnswer((await res.json()) as SearchResponse), error: null };
  } catch {
    return { data: null, error: "The trust service could not be reached." };
  }
}
