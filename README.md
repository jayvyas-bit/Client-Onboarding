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
| `GOOGLE_OAUTH_CLIENT_ID` | Submission PDF delivery | OAuth 2.0 client ID (Desktop app type) from Google Cloud Console |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Submission PDF delivery | OAuth 2.0 client secret paired with the client ID |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | Submission PDF delivery | Long-lived refresh token for the Google account that owns the uploads (obtained via a one-time consent flow) |
| `GOOGLE_DRIVE_FOLDER_ID` | Submission PDF delivery | ID of the Drive folder (owned by, or shared as Editor with, the OAuth-authorized account) to upload PDFs into |
| `NOTIFICATION_EMAIL_TO` | Submission PDF delivery | Google account to notify (Drive's native share-notification email) when a new PDF is uploaded |

If the Drive variables are unset, submissions still save to the database — the PDF/upload step is
skipped with a warning instead of failing the request. Set these in the Vercel project dashboard
(Settings → Environment Variables).
