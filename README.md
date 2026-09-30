# Trust-ranked knowledge base

**SD Worx challenge, "Unlock the Knowledge Within".** From "I found something" to "I understand why I can rely on it".

**Live demo:** https://sdworx-trust-b4kskswygq-uc.a.run.app
**All data is synthetic.** It contains no real SD Worx documents, clients or people.

## The problem

A payroll consultant gets an urgent client question. The search returns several documents:
- one current policy
- one without an owner
- one for another country
- a Teams message that contradicts the policy

The information exists, but the consultant can't tell which one to act on.

## What it does

1. **Ask:** pick a client (country, client type) and type a question in your own words.
2. **See why to trust it:** documents are ranked by relevance, then by a visible **trust score** made of five factors with their weights:

   | Factor | Weight |
   |---|---:|
   | current (reviewed within its interval, not superseded) | 30% |
   | source type (policy > expert note > chat) | 20% |
   | owned (has an accountable owner role) | 15% |
   | applies here (right country and client type) | 15% |
   | track record (confirmed solved cases in the same scope) | 20% |

   - Every result says why it was demoted and **who can help**.
   - The top answer gets a label: ✅ Verified, 🟡 Likely, ⚠️ Conflicting or ❔ Unknown.
   - Documents for another country are set aside.
   - Restricted documents show only that they exist and who owns them, with a "request access" button.
3. **Act, and the system learns:**
   - **"This solved it"** raises trust, but only for that country and client type. The owner approves the documentation update.
   - **Report a document** as outdated, wrong or wrong country. Each report is a small penalty, and the owner decides.
   - **Conflicts are never resolved silently.** They go to both owners with an evidence pack. The owner keeps one (citing the law, agreement or contract they checked), splits the scope, or escalates.
   - Every action is written to an **audit log**.

**Trust on/off:** the same question with plain search (keyword match, newest first) versus trust ranking. On our 12 demo questions, plain search picks the right document **2/12** times and trust ranking **12/12** (`cd backend && npm run eval`). The synonyms were tuned on this demo set, so treat it as an illustration, not a benchmark.

## No black box

- Every score can be traced to document metadata and confirmed cases.
- No AI is used at question time. Relevance is deterministic keyword and synonym matching, and the explanations are templates built from the factor values.
- The weights are defaults. In practice SD Worx's risk owners would set them.

## Security and privacy

- **We score documents, never people.** Ownership is a role, not a named person. Author seniority and activity are deliberately not used.
- **Server-side checks:**
  - only the owner role can approve, review a report or resolve a conflict
  - one report per role per document
  - restricted documents are filtered out before ranking, so their content never reaches the response
- **No external calls at question time,** no secrets in the repo, and synthetic data only.
- **Simulated, and disclosed:** identity is a role switcher, not real login. A pilot would use SD Worx's identity system, run in an EU region, and go through a DPIA and works-council review before any email or chat sources are added.

## Run it

Requires Node 20+.

```
cd backend && npm test          # 38 tests, no network needed
cd backend && npm run dev       # API on http://localhost:8787
cd app && npm install && npm run build && cd .. && PORT=8080 node backend/server.js   # app + API on :8080
```

- Architecture, rules, API contract and demo scenarios: [backend/PLAN.md](backend/PLAN.md)
- Deployment (Google Cloud Run, one container): [backend/README.md](backend/README.md)

## Real vs simulated

| Real | Simulated (disclosed) |
|---|---|
| Relevance ranking, trust scoring, gates, labels | Connections to SD Worx systems (25 synthetic documents) |
| Solved cases, reports, conflicts, owner decisions, audit log | Email and chat sources (a few synthetic Teams snippets) |
| Server-side permission checks | Identity (a role switcher instead of login) |
| Live deployment on Google Cloud Run | Company-wide ingestion and monitoring (90-day pilot) |
