import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS unpause_submissions (
      id uuid PRIMARY KEY,
      submitted_at timestamptz NOT NULL,
      answers jsonb NOT NULL
    )
  `;

  const { rows } = await sql`
    SELECT id, submitted_at, answers FROM unpause_submissions ORDER BY submitted_at DESC
  `;

  const submissions = rows.map((row) => ({
    id: row.id as string,
    submittedAt: new Date(row.submitted_at as string).toISOString(),
    answers: row.answers,
  }));

  res.status(200).json({ ok: true, submissions });
}
