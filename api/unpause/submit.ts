import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_lib/db.js";
import { randomUUID } from "node:crypto";

async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS unpause_submissions (
      id uuid PRIMARY KEY,
      submitted_at timestamptz NOT NULL,
      answers jsonb NOT NULL
    )
  `;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const { answers } = (req.body ?? {}) as { answers?: unknown };
  if (!answers || typeof answers !== "object") {
    res.status(400).json({ ok: false, error: "invalid_body" });
    return;
  }

  await ensureTable();

  const id = randomUUID();
  const submittedAt = new Date().toISOString();

  await sql`
    INSERT INTO unpause_submissions (id, submitted_at, answers)
    VALUES (${id}, ${submittedAt}, ${JSON.stringify(answers)}::jsonb)
  `;

  res.status(200).json({ ok: true, id });
}
