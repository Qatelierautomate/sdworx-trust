# Trust-ranked knowledge base

**SD Worx challenge, "Unlock the Knowledge Within".** From "I found something" to "I understand why I can rely on it".

- **Live demo (Knowledge Hub):** https://hubbard-insight-engine.lovable.app/login
- **Live backend API:** https://sdworx-trust-b4kskswygq-uc.a.run.app (try `/api/health` or `/api/evaluation`)
- **All data is synthetic.** It contains no real SD Worx documents, clients or people.

### Try it in 1 minute

1. Open the live demo and use the **one-click demo sign-in**.
2. Choose **Belgium + SME** and ask *"Can a Belgian SME correct payroll after closing?"* → ⚠️ **Conflicting**. The official procedure and an expert shortcut disagree with similar trust. Both are quoted, and both owners are named.
3. Choose **Belgium + Mid-Market** and ask *"An employee got a raise halfway through the month, how do I pay it?"* → ✅ **Verified**. The current Belgian procedure wins. A Teams message saying "just backdate it" is flagged as much less reliable.
4. Choose **Germany** and ask anything → ❔ **no answer**, and who to ask. The tool doesn't make something up.

## The problem

A payroll consultant gets an urgent client question. The search returns several documents:
- one current policy
- one without an owner
- one for another country
- a Teams message that contradicts the policy

The information exists, but the consultant can't tell which one to act on.

## How it decides what to trust

Documents are matched to the question (keywords and payroll synonyms), filtered by access and country, then ranked by a visible **trust score**:

| Factor | Weight | Value |
|---|---:|---|
| Current | 30% | 1 within the review interval, falling to 0 at twice the interval; 0 if superseded |
| Source type | 20% | policy 1.0, expert note 0.7, chat 0.3 |
| Owned | 15% | 1 if an accountable owner role and a review date exist |
| Applies here | 15% | 1 for the right country and client type, 0.5 for the right country only |
| Track record | 20% | confirmed solved cases in the same country and client type, recent ones count more |

- **Gates:**
  - Documents for another country are set aside, not ranked.
  - Superseded documents are capped at 0.2.
  - Restricted documents show only that they exist and who owns them.
- **Label on the answer:** ✅ Verified (a current, owned policy), 🟡 Likely (weaker sources), ⚠️ Conflicting (a contradicting source within 0.10 trust), ❔ Unknown (nothing reliable).
- **Reasons:** every answer lists why it can or can't be trusted, its weakest factor, and **who can help**.

## What is in the live app vs the API

| Knowledge Hub (live demo) | Backend API (live, tested) |
|---|---|
| Question by country, customer type and product | Everything the hub uses: `/api/search` |
| Answer, trust label, "Can you trust this answer?" reasons, next step | Full ranked list with the five factor scores and weights, statuses, applies-elsewhere and locked documents |
| Sign-in with a demo account | **"This solved it":** trust rises only for that country and client type. The owner approves the update |
| **Blocks questions containing personal data** (national register number, email, phone) | **Report a document:** a small penalty while open. Only the owner confirms or rejects |
| Escalation path to owner, team lead and manager | **Conflicts:** sent to both owners with an evidence pack. They keep one (citing the law, agreement or contract checked), split the scope, or escalate |
| | Access requests, and an **audit log** of every action |
| | `trust: false` plain-search baseline and the evaluation below |

The API contract, rules and 9 demo scenarios are in [backend/PLAN.md](backend/PLAN.md).

## Evaluation

On 12 known-answer demo questions, **plain keyword search (newest first) picks the right document 2/12 times, and trust ranking 12/12.** Plain search puts the Teams message or another country's document on top. Run it with `cd backend && npm run eval`, or `GET /api/evaluation`.

This is our own demo set, and the synonyms were tuned on it. Treat it as an illustration, not a benchmark.

## No black box

- Every score can be traced to document metadata and confirmed cases.
- No AI decides what is true. Relevance is deterministic keyword and synonym matching, and the reasons are built from the factor values.
- The weights are defaults. In practice SD Worx's risk owners would set them per domain or country.

## Security and privacy

- **We score documents, never people.** Ownership is a role, not a named person. Author seniority and activity are deliberately not used.
- **Server-side checks:**
  - only the owner role can approve, review a report or resolve a conflict
  - one report per role per document
  - restricted documents are filtered out before ranking, so their content never reaches the response
- **No secrets in the repo.** The demo sign-in password comes from an environment variable.
- **Minimal data flow.** No question or document text is sent to an AI provider.
- **Aikido scan:** all findings fixed (dependency upgrades, no hard-coded credentials, the container runs as a non-root user).
- **Simulated, and disclosed:**
  - the backend's roles (consultant, key-account team, owners) are passed in the request
  - a pilot would use SD Worx's identity system and run in an EU region (the demo backend runs in `us-central1`)
  - a pilot would go through a DPIA and works-council review before any email or chat sources are added

## Repository layout

- `backend/`: the trust engine and API. Node, no dependencies, 38 tests.
- `hub/`: the Knowledge Hub frontend (TanStack Start + React, built with Lovable). It calls the backend's `/api/search`; set `TRUST_BACKEND_URL` to use another backend.
- `app/`: the synthetic demo data (`app/src/data/`) and a minimal fallback page served by the backend.

## Run it

Requires Node 20+.

```
cd backend && npm test          # 38 tests, no network needed
cd backend && npm run dev       # API on http://localhost:8787
cd backend && npm run eval      # plain search vs trust ranking
```

The hub needs its own Supabase project for sign-in (see `hub/`). The live demo link is the easiest way to see it.

Deployment (Google Cloud Run, one container): [backend/README.md](backend/README.md)

## Real vs simulated

| Real | Simulated (disclosed) |
|---|---|
| Relevance, trust scoring, gates, labels, reasons | Connections to SD Worx systems (25 synthetic documents) |
| Solved cases, reports, conflicts, owner decisions, audit log (API) | Email and chat sources (a few synthetic Teams snippets) |
| Server-side permission checks | Real SD Worx identity and access rules |
| Live deployment (Cloud Run backend, Lovable frontend) | Company-wide ingestion and monitoring (90-day pilot) |
