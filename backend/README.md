# Backend

A small Node API with no dependencies. It serves the trust-ranked search, the solved-case workflow and the audit log, and in production the built frontend too. It reads the synthetic fixtures in `app/src/data/`. The Gemini key (`SERVER_AI_API_KEY`) stays here, on the server, never in the browser. How it works and the full API: [PLAN.md](PLAN.md).

## Run locally

```
cd backend
npm run dev     # http://localhost:8787, reloads on change, reads ../.env if present
npm test        # 31 tests, no network needed
```

To serve the frontend from the backend like production does: `cd app && npm run build`, then `PORT=8080 node backend/server.js` from the repo root.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 8787 (Cloud Run sets 8080) | HTTP port |
| `DEMO_NOW` | 2026-09-30 | Fixed date the scores are computed against |
| `SERVER_AI_API_KEY` | empty | Gemini API key. If it is empty, the backend uses template explanations |
| `GEMINI_MODEL` | empty | Gemini model id. Both it and the key are needed for AI mode |

## Deploy (Google Cloud Run)

Live: https://sdworx-trust-b4kskswygq-uc.a.run.app (Google Cloud Run, region `us-central1`). The lab blocks all Vertex AI models, so it runs in template mode.

One service built from the root `Dockerfile`. Run it from the repo root. Redeploying after a push is the same command:

```
gcloud run deploy sdworx-trust --source . --region us-central1 --allow-unauthenticated \
  --min-instances 1 --max-instances 1 --set-env-vars DEMO_NOW=2026-09-30 --quiet
```

Exactly one instance, on purpose: state is kept in memory, and one instance that is always on has no startup delay during the pitch. Before each pitch run: `POST /api/reset`.
