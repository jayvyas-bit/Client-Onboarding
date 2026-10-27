import { randomUUID } from "node:crypto";
import { mkdirSync, appendFileSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Plugin, Connect } from "vite";

const DATA_DIR = path.resolve(process.cwd(), "data");
const SUBMISSIONS_FILE = path.join(DATA_DIR, "unpause-submissions.jsonl");
const UPLOADS_DIR = path.join(DATA_DIR, "unpause-uploads");

const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25MB — generous for a few reference images per submission

function ensureDataDirs() {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

function sanitizeFileName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.length > 0 ? base : "file";
}

function readJsonBody(req: Connect.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

interface InlineFile {
  name: string;
  dataUrl: string;
}

function isInlineFile(value: unknown): value is InlineFile {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as InlineFile).name === "string" &&
    typeof (value as InlineFile).dataUrl === "string"
  );
}

function storeInlineFile(submissionId: string, file: InlineFile) {
  const match = /^data:(.+?);base64,(.*)$/.exec(file.dataUrl);
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  const dir = path.join(UPLOADS_DIR, submissionId);
  mkdirSync(dir, { recursive: true });
  const safeName = sanitizeFileName(file.name);
  const filePath = path.join(dir, safeName);
  writeFileSync(filePath, buffer);
  return {
    name: file.name,
    size: buffer.length,
    path: path.relative(DATA_DIR, filePath),
  };
}

function resolveFilesInAnswers(submissionId: string, answers: Record<string, unknown>) {
  for (const key of Object.keys(answers)) {
    const value = answers[key];
    if (value && typeof value === "object" && "files" in (value as Record<string, unknown>)) {
      const uploadValue = value as { text?: string; files?: unknown[] };
      const resolvedFiles = (uploadValue.files ?? [])
        .map((f) => (isInlineFile(f) ? storeInlineFile(submissionId, f) : null))
        .filter((f): f is NonNullable<typeof f> => f !== null);
      answers[key] = { text: uploadValue.text ?? "", files: resolvedFiles };
    }
  }
}

export function unpauseIntakeApiPlugin(): Plugin {
  return {
    name: "unpause-intake-api",
    configureServer(server) {
      ensureDataDirs();

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/unpause/")) {
          next();
          return;
        }

        if (req.method === "POST" && req.url === "/api/unpause/submit") {
          try {
            const body = (await readJsonBody(req)) as { answers?: Record<string, unknown> };
            const submissionId = randomUUID();
            const answers = body.answers ?? {};
            resolveFilesInAnswers(submissionId, answers);

            const record = {
              id: submissionId,
              submittedAt: new Date().toISOString(),
              answers,
            };
            appendFileSync(SUBMISSIONS_FILE, JSON.stringify(record) + "\n", "utf8");

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, id: submissionId }));
          } catch (err) {
            res.statusCode = err instanceof Error && err.message === "payload_too_large" ? 413 : 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: (err as Error).message }));
          }
          return;
        }

        if (req.method === "GET" && req.url === "/api/unpause/submissions") {
          const content = existsSync(SUBMISSIONS_FILE) ? readFileSync(SUBMISSIONS_FILE, "utf8") : "";
          const records = content
            .split("\n")
            .filter((line) => line.trim().length > 0)
            .map((line) => JSON.parse(line));
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, submissions: records }));
          return;
        }

        next();
      });
    },
  };
}
