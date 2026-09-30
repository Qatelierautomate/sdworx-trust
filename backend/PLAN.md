# Backend: how it works and the API contract

Status: everything below is built and tested (`npm test`). Deployment on Google Cloud is in progress.

## What the backend does

The frontend is only screens. The backend decides what goes on them. When the consultant asks a question for a client, the backend:
1. finds the matching documents,
2. hides the content of documents their role may not see,
3. moves documents for another country aside,
4. scores each remaining document's trust from its metadata,
5. sorts them and says why each one was demoted.

When the consultant clicks "this solved it", the backend records the case for that country and client type only, recomputes the scores, and drafts a documentation update for the owner. When the owner approves, the backend writes it to the audit log. Gemini only rewrites the explanation into plainer language. The template text is always the fallback, and the Gemini key lives only on the server.

```
Browser (React screens)
   |  JSON over /api/*  (same origin in production)
   v
backend/server.js  (one Cloud Run service; also serves app/dist)
   |-- src/relevance.js  question -> matching documents
   |-- src/search.js     access filter, country gate, conflicts, sort
   |-- src/scoring.js    5 trust factors x weights -> total, status, reasons
   |-- src/workflow.js   solved cases, proposals, approvals, access requests, audit
   |-- src/explain.js    template text, optionally rewritten by Gemini, then fact-checked
   |-- src/gemini.js     the only external call (4 s timeout, null on failure)
   v
src/data.js: in-memory state loaded from app/src/data/*.json (synthetic)
```

## Rules

- **Clock:** scores use `DEMO_NOW` (default 2026-09-30), so they never drift. Audit timestamps use the real clock.
- **Relevance (no AI):** the question is expanded with payroll synonyms: raise → salary change, mistake → correction, taking over → handover, ill → sick leave. Its words are then matched against each document's keywords (weight 3), title (2) and text (1). Rare words count more than common ones, and filler words are ignored. A document needs at least one keyword or title hit to qualify. Relevance is relative to the best match, and documents below half of it are dropped. Free-form questions work. Off-topic questions return "nothing reliable".
- **Access (simulated role switcher):** roles `all-consultants` and `key-account-team`. Key-account members see everything consultants see, plus the restricted documents D07 and D21. For other roles, a restricted document shows only that it exists and who owns it.
- **Country gate:** a document for another country (not `ALL`) goes to `appliesElsewhere` and is not scored.
- **Trust** = Σ weight × factor:
  - **current:** 1 within the review interval, falling to 0 at twice the interval. 0 if superseded.
  - **source type:** policy 1, expert-note 0.7, chat 0.3.
  - **owned:** 1 when the document has both an owner and a review date.
  - **applies here:** 1 when the client type matches or is `all`, otherwise 0.5.
  - **track record:** solved cases in exactly this country and client type, with a 12-month half-life, capped at 3.
- **Gates:**
  - Superseded → trust capped at 0.2.
  - Status priority: `locked` > `outdated` (superseded, or current = 0) > `conflict` (a contradiction between two visible results; both are flagged) > `ownerless` > `ok`.
- **Reasons** list every issue, then the weakest factor, then who can help. When a document has no owner, the helper is the country's policy owner.
- **Solved case:** counts at once, for this country and client type only. It creates a proposal for the document owner (or for the country policy owner when the document has none). Only that role can approve. Approving marks the document reviewed today and appends the confirmed case to its text. Every action is written to the audit log.
- **Explanation:** built from the reasons. A Gemini rewrite is used only if every number, date and id in it already appears in the template.

## API

All request and response bodies are JSON. Errors return `{ "error": "..." }` with status 400, 403, 404 or 409.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/health` | | `{ ok, aiMode: "gemini" \| "template" }` |
| GET | `/api/bootstrap` | | `{ clients, roles, weights, weightsLabel, disclosure, aiMode }` |
| POST | `/api/search` | `{ question, clientId, role, trust? }` (`trust: false` = plain search baseline: keyword match, newest first, no country gate) | search response (below). An empty question → 400 `{ error: "empty", examples }` |
| POST | `/api/solved` | `{ docId, clientId, role, question?, outcome? }` | `{ case, proposal, search }`. `search` is recomputed when `question` is sent |
| GET | `/api/proposals` | | all proposals |
| POST | `/api/proposals/:id/approve` | `{ role, decision: "approve" \| "reject" }` | `{ proposal, auditEntry }`. Only `proposal.ownerRole` may decide |
| POST | `/api/access-requests` | `{ docId, role }` | `{ auditEntry, message }` |
| POST | `/api/reports` | `{ docId, role, reason: "outdated" \| "wrong" \| "wrong-country" }` | the report. -0.05 trust while it is open (max -0.15). One per role per document (409) |
| GET | `/api/reports?role=<ownerRole>` | | the owner's inbox: reports on their documents |
| POST | `/api/reports/:id/review` | `{ role, decision: "confirm-outdated" \| "confirm-correct" \| "reject" }` | `{ report, auditEntry }`. Owner only (403). Outdated → trust capped at 0.05 and removed from answers. Correct → trust at least 0.9. Reject → penalty removed |
| POST | `/api/conflicts` | `{ docIds: [a, b], role, question? }` (take `docIds` from `confidence.docIds`) | the escalation, assigned to the owners of both documents. Returns the existing one if already open |
| GET | `/api/conflicts?role=<ownerRole>` | | the owner's open conflicts, each with an `evidence` pack: both documents, their solved cases and reports |
| POST | `/api/conflicts/:id/resolve` | `{ role, decision: "keep" \| "split-scope" \| "escalate", keepDocId?, basis?, escalateTo? }` | `{ conflict, auditEntry }`. Assigned owners only (403). `keep` and `split-scope` need `basis` (the law, agreement or contract they checked). `keep` → the kept document is confirmed correct (with its basis shown in reasons), the other is outdated. `split-scope` → both stay valid. `escalate` → reassigned to `escalateTo` ("I don't know") |
| GET | `/api/evaluation` | | known-answer questions, trust off vs on: `{ total, plainCorrect, trustedCorrect, rows }` (currently 2/12 vs 12/12) |
| GET | `/api/audit` | | audit entries, newest first: `{ id, at, actorRole, action, target, before, after }` |
| PATCH | `/api/documents/:id` | `{ date?, ownerRole?, role? }` | the updated document (demo control for the acceptance check) |
| POST | `/api/reset` | | `{ ok: true }`. Restores the fixtures. Run it before every pitch |

### Example: `POST /api/search`
Request `{ "question": "How do we handle a mid-month salary change?", "clientId": "CL1", "role": "all-consultants" }`. This is a real response, shortened to 2 of its 6 results:
```json
{
  "question": "How do we handle a mid-month salary change?",
  "role": "all-consultants",
  "client": { "id": "CL1", "name": "Alpine Logistics", "country": "BE", "clientType": "mid-size", "sampleQuestions": ["..."] },
  "results": [
    {
      "docId": "D01", "title": "Procedure: mid-month salary change (BE)", "snippet": "Apply the new salary pro rata ...",
      "sourceType": "policy", "date": "2026-08-12", "ownerRole": "Payroll Belgium policy owner",
      "country": "BE", "clientType": "all", "relevance": 0.67, "matchedKeywords": ["salary change", "mid-month"],
      "trust": {
        "total": 0.92,
        "factors": { "current": 1, "sourceType": 1, "owned": 1, "appliesHere": 1, "trackRecord": 0.62 },
        "weights": { "current": 0.3, "sourceType": 0.2, "owned": 0.15, "appliesHere": 0.15, "trackRecord": 0.2 }
      },
      "status": "conflict",
      "reasons": [
        "Contradicted by D06 (Teams thread: \"just backdate it to the 1st\")",
        "2 solved cases for BE mid-size clients",
        "Weakest factor: track record (0.62)",
        "Who can help: Payroll Belgium policy owner"
      ],
      "conflictsWith": ["D06"],
      "locked": false
    },
    {
      "docId": "D07", "locked": true, "status": "locked", "ownerRole": "Alpine Logistics account lead",
      "reasons": ["Restricted for your role. Request access from Alpine Logistics account lead"]
    }
  ],
  "appliesElsewhere": [{ "docId": "D03", "title": "Procedure: mid-month salary change (NL)", "country": "NL", "ownerRole": "Payroll Netherlands policy owner" }],
  "conflicts": [{ "docIds": ["D01", "D06"], "note": "Procedure: mid-month salary change (BE) and Teams thread: \"just backdate it to the 1st\" disagree" }],
  "nothingReliable": null,
  "explanation": { "text": "\"Procedure: mid-month salary change (BE)\" is the most trustworthy match ... Do not act on it until the owner confirms which source is right.", "source": "template" }
}
```
- Locked results always come last and contain only `docId`, `locked`, `status`, `ownerRole`, `reasons`.
- When nothing applies: `results: []` and `nothingReliable: { "askRole": "Payroll Netherlands policy owner", "appliesElsewhereCount": 3 }`.

### Example: `POST /api/solved`
Request `{ "docId": "D12", "clientId": "CL2", "role": "all-consultants", "question": "Can we correct a closed pay run retroactively?", "outcome": "Sent the template, client agreed." }`
```json
{
  "case": { "id": "C14", "documentId": "D12", "scope": { "country": "FR", "clientType": "mid-size" }, "date": "2026-09-30", "outcome": "Sent the template, client agreed." },
  "proposal": { "id": "P1", "docId": "D12", "caseId": "C14", "ownerRole": "Payroll France client team",
    "change": "Add confirmed case C14 (FR, mid-size) and mark as reviewed 2026-09-30", "note": null,
    "requestedBy": "all-consultants", "status": "pending" },
  "search": { "...": "same shape as /api/search, D12 is now first (0.81 vs 0.80)" }
}
```

## Confidence label (on every trust search)

`confidence: { label: "verified" | "likely" | "conflicting" | "unknown", note }`:
- **verified:** the top result is a current, owned policy.
- **likely:** the top result is weaker (an expert note or a chat), with no close rival.
- **conflicting:** a contradicting document is within 0.10 trust of the top one. `confidence.docIds` names the two documents; show them side by side, not as #1 and #2. `confidence.conflictId` is set once it has been escalated.
- **unknown:** nothing found.

A contradicting document with much lower trust shows up only in `note` (for example "D06 says otherwise but has much lower trust (0.51)"). It is still listed in `conflicts`.

## Demo scenarios (each one is an automated test)

| # | Input | What the backend does |
|---|---|---|
| 1 | CL1 Alpine (BE, mid-size): "How do we handle a mid-month salary change?" | D01 0.92 conflict (contradicted by chat D06), D04 0.79, D05 0.59 ownerless, D06 0.51, D02 0.20 outdated (superseded), D07 locked. D03 (NL) applies elsewhere |
| 2 | CL2 Brasserie (FR, mid-size): "Can we correct a closed pay run retroactively?", then solve D12 | D11 0.80 > D12 0.74. After solving, D12 is 0.81 and takes first place. Proposal P1 goes to the Payroll France client team. The owner approves and it is audited. BE results don't change |
| 3 | CL1: "What do I need to know to take over this client?" | D20 0.86 (conflict with chat D22), D22 outdated, D21 locked → request access. With the key-account role, D21 is visible (0.74) |
| 4 | CL2: "What is the sick leave reporting deadline?" | Only D14 (0.80). D13, D15 and D16 apply elsewhere (BE) |
| 5 | CL3 Noordzee (NL): "What are the year-end closing dates?" | Nothing reliable. Ask the Payroll Netherlands policy owner. 3 documents apply elsewhere |
| 6 | `PATCH /api/documents/D01 { "ownerRole": null }` | D01 falls to 0.77, below D04 |
| 7 | Gemini offline, or inventing a number | The template text is used, with `source: "template"` |
| 9 | CL1 Alpine: "Can we correct a closed pay run retroactively?" | ⚠️ Conflicting: D08 policy (0.86) vs D09 expert shortcut (0.78). Escalate → both owners get the evidence. The mid-size team doesn't know → escalates to Legal Belgium → keeps D08, citing the instruction it checked → ✅ Verified "Owner confirmed this is correct, based on: ...". D09 is removed from answers |
| 8 | `POST /api/reset` | Back to the fixtures, with the audit log cleared |

## Integration notes for the frontend

- Call `/api/...` with relative paths. In production, the frontend and API share one URL.
- Locally: run `cd backend && npm run dev` (port 8787). Add a Vite proxy to `app/vite.config.js`: `server: { proxy: { "/api": "http://localhost:8787" } }`.
- Send the role from the role switcher on every search, solve and access request. For owner approval, send the proposal's `ownerRole` as `role` (a simulated "switch to owner" button).
- Show `explanation.source`. When it is `template`, that is the deterministic mode. Disclose it.
