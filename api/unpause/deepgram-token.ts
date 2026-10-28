import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    res.status(500).json({ ok: false, error: "deepgram_not_configured" });
    return;
  }

  const grant = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: { Authorization: `Token ${apiKey}` },
  });

  if (!grant.ok) {
    res.status(502).json({ ok: false, error: "deepgram_grant_failed" });
    return;
  }

  const { access_token, expires_in } = (await grant.json()) as {
    access_token: string;
    expires_in: number;
  };

  res.status(200).json({ ok: true, accessToken: access_token, expiresIn: expires_in });
}
