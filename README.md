# Client Onboarding

Step-1 validation intake form (typed-only, single-journey "Unbrief") plus an internal review
dashboard for reading submissions.

## Routes

- `/` — the intake form
- `/review` — internal dashboard listing submissions

## Dev

```bash
npm install
npm run dev
```

Submissions are stored as flat files under `data/` (gitignored — may contain real contact info):

- `data/unpause-submissions.jsonl` — one JSON record per submission
- `data/unpause-uploads/<submission-id>/<filename>` — uploaded reference files
