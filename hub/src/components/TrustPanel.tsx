import { CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type Certainty = "verified" | "likely" | "conflicting" | "no_answer";

const certaintyTone: Record<Certainty, string> = {
  verified: "bg-success-soft text-success",
  likely: "bg-warning-soft text-warning-foreground",
  conflicting: "bg-conflict-soft text-conflict",
  no_answer: "bg-destructive/10 text-destructive",
};

export function CertaintyBadge({ level, labels }: { level: Certainty; labels?: Partial<Record<Certainty, string>> }) {
  const label = labels?.[level] ?? level;
  const tone = certaintyTone[level] ?? certaintyTone.likely;
  return (
    <Badge variant="outline" className={`gap-1.5 border-0 ${tone}`}>
      <span className="size-2 rounded-full bg-current" aria-hidden="true" />
      {label}
    </Badge>
  );
}

// Reasons from the trust backend. Warnings are the ones that should make the employee pause.
const WARNING = /^(Outdated|Review overdue|Contradicted|No owner|Written for|Reported|Weakest|Restricted|No reliable)/;

const SUMMARY: Record<Certainty, string> = {
  verified: "Yes. This comes from a current, owned policy.",
  likely: "Probably. The best source is not an official current policy.",
  conflicting: "Not yet. Two sources disagree with similar trust.",
  no_answer: "No. Nothing reliable covers this question.",
};

export function TrustPanel({ notes = [], certainty = "likely" }: { notes?: string[]; certainty?: Certainty }) {
  const helper = notes.find((n) => n.startsWith("Who can help:"));
  const shown = notes.filter((n) => n !== helper);
  return (
    <section className="border bg-surface-raised p-5 shadow-sm" aria-label="Can you trust this answer?">
      <h2 className="font-display text-base font-bold">Can you trust this answer?</h2>
      <p className="mt-1 text-sm text-muted-foreground">{notes.length ? SUMMARY[certainty] : "Ask a question to see why an answer can be trusted."}</p>

      <ul className="mt-4 space-y-3">
        {shown.map((note) => (
          <li key={note} className="flex items-start gap-2.5 text-sm leading-6">
            {WARNING.test(note) ? (
              <AlertTriangle className="size-5 shrink-0 text-warning" />
            ) : (
              <CheckCircle2 className="size-5 shrink-0 text-success" />
            )}
            <span>{note}</span>
          </li>
        ))}
      </ul>
      {helper && (
        <div className="mt-4 flex items-start gap-2 rounded-md border-l-4 border-info bg-info-soft px-3 py-2.5">
          <ArrowRight className="mt-1 size-4 shrink-0 text-info" />
          <p className="text-sm leading-6">
            <strong>Next step:</strong> ask {helper.slice("Who can help: ".length)}.
          </p>
        </div>
      )}
    </section>
  );
}
