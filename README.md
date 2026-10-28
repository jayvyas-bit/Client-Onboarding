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

## Backend

Serverless functions live under `api/unpause/` (Vercel Node functions) and talk to a Supabase
Postgres database via `api/_lib/db.ts`:

- `POST /api/unpause/submit` — validates and inserts a submission into `unpause_submissions`
  (`id`, `submitted_at`, `answers` jsonb), then generates a PDF transcript and emails it to the
  team (best-effort; failures here don't affect the submit response).
- `GET /api/unpause/submissions` — lists submissions for the internal `/review` dashboard.
- `POST /api/unpause/upload` — issues Vercel Blob upload tokens for reference-file uploads.

### Environment variables

| Variable | Required for | Notes |
| --- | --- | --- |
| `SUPABASE_DB_URL` | DB access | Postgres connection string |
| `BLOB_READ_WRITE_TOKEN` | File uploads | Vercel Blob store token |
| `RESEND_API_KEY` | Submission email | From a [Resend](https://resend.com) account |
| `NOTIFICATION_EMAIL_FROM` | Submission email | Must be a verified sending address/domain in Resend |
| `NOTIFICATION_EMAIL_TO` | Submission email | Where the submission PDF gets sent |

If the email variables are unset, submissions still save to the database — the PDF/email step is
skipped with a warning instead of failing the request. Set these in the Vercel project dashboard
(Settings → Environment Variables).
