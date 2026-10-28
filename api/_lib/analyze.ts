import { SECTIONS } from "../../src/unpause/content.js";
import { formatValue } from "../../src/unpause/formatAnswer.js";

function buildTranscript(answers: Record<string, unknown>): string {
  const lines: string[] = [];

  for (const section of SECTIONS) {
    if (section.condition && !section.condition(answers)) continue;

    lines.push(`## ${section.number} — ${section.title}`);

    for (const question of section.questions) {
      lines.push(`Q${question.number}. ${question.prompt}`);

      for (const qp of question.parts) {
        const key = `${question.id}.${qp.id}`;
        const otherKey = `${key}__other`;
        const value = answers[key];
        const otherValue = answers[otherKey];
        const label = qp.label ? `${qp.label}: ` : "";
        const text = `${label}${formatValue(value)}${otherValue ? ` (${otherValue})` : ""}`;
        lines.push(`- ${text}`);
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are a senior creative strategist at a branding studio called Unpause. You've just received a new client intake form (nicknamed "The Unbrief"). Read the client's raw answers and write a short internal briefing for the design team (Vera, Iris, Dex) who will review this before the kickoff call.

Structure your response in these sections, using plain text with simple headers (no markdown symbols like ** or #):

FOUNDER PROFILE
Who this person is as a founder/creative: their role, how they describe themselves and their motivations, their decision-making style, and how they prefer to collaborate. Synthesize this from their answers, don't just restate their name and title.

COMPANY PROFILE
What the brand makes or sells, where it is in its journey, who it serves and why people choose it, and how it positions itself against alternatives. This is the business snapshot the team needs before the call.

WHY NOW
What's driving this project right now, and what success looks like to them in their own words.

AESTHETIC DIRECTION
What visual direction the answers point to (tone, references, likes/dislikes), flagged as a hypothesis for the designers to confirm, not a final decision.

PRACTICAL CONSTRAINTS
Timeline, budget signals, decision-making structure, and anything that could affect scope.

OPEN QUESTIONS FOR THE KICKOFF CALL
2-4 specific, sharp questions the team should ask to fill gaps or resolve ambiguity in their answers.

Keep the whole thing under 420 words. Be concrete and specific to THIS client's actual answers, never generic boilerplate. If a section has nothing meaningful to say because the client left it blank or it doesn't apply, say so briefly rather than inventing content.`;

export async function generateSmartAnalysis(answers: Record<string, unknown>): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const transcript = buildTranscript(answers);
  if (!transcript.trim()) return null;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: transcript }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1536 },
        }),
      },
    );

    if (!res.ok) {
      console.error("analyze: gemini request failed", res.status, await res.text());
      return null;
    }

    const body = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return text.trim() || null;
  } catch (err) {
    console.error("analyze: gemini call threw", err);
    return null;
  }
}
