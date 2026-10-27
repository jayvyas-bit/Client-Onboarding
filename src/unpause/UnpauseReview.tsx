import { useEffect, useState } from "react";
import { SECTIONS } from "./content";
import type { QuestionPart, QuestionSpec } from "./types";

interface StoredUploadFile {
  name: string;
  size: number;
  path: string;
}

interface Submission {
  id: string;
  submittedAt: string;
  answers: Record<string, unknown>;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("files" in obj || "text" in obj) {
      const text = (obj.text as string) ?? "";
      const files = (obj.files as StoredUploadFile[]) ?? [];
      const fileList = files.map((f) => f.name).join(", ");
      return [text, fileList && `Files: ${fileList}`].filter(Boolean).join(" — ") || "—";
    }
    const entries = Object.entries(obj).filter(([, v]) => v !== "" && v !== undefined);
    if (entries.length === 0) return "—";
    return entries.map(([k, v]) => `${k}: ${v}`).join(" · ");
  }
  if (typeof value === "number") return String(value);
  return String(value);
}

function SubmissionTranscript({ submission }: { submission: Submission }) {
  return (
    <div className="flex flex-col gap-6">
      {SECTIONS.map((section) => (
        <div key={section.id}>
          <p className="text-xs font-medium tracking-wide text-neutral-400">
            {section.number} — {section.title}
          </p>
          <div className="mt-2 flex flex-col gap-3">
            {section.questions.map((question: QuestionSpec) => (
              <div key={question.id} className="rounded-lg bg-neutral-50 p-3">
                <p className="text-sm font-medium text-neutral-800">
                  Q{question.number}. {question.prompt}
                </p>
                <div className="mt-1.5 flex flex-col gap-1">
                  {question.parts.map((qp: QuestionPart) => {
                    const key = `${question.id}.${qp.id}`;
                    const otherKey = `${key}__other`;
                    const value = submission.answers[key];
                    const otherValue = submission.answers[otherKey];
                    return (
                      <p key={key} className="text-sm text-neutral-600">
                        {qp.label && <span className="text-neutral-400">{qp.label}: </span>}
                        {formatValue(value)}
                        {otherValue ? ` (${otherValue})` : ""}
                      </p>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function UnpauseReview() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/unpause/submissions")
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) throw new Error("failed");
        const sorted = [...data.submissions].sort(
          (a: Submission, b: Submission) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
        );
        setSubmissions(sorted);
        if (sorted.length > 0) setSelectedId(sorted[0].id);
      })
      .catch(() => setError("Could not load submissions. Is the dev server running?"))
      .finally(() => setLoading(false));
  }, []);

  const selected = submissions.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-10">
        <aside className="w-72 shrink-0">
          <p className="text-xs font-medium tracking-[0.2em] text-neutral-400">INTERNAL — VALIDATION STEP 1</p>
          <h1 className="mt-1 text-xl font-medium text-neutral-900">Unbrief submissions</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {submissions.length} submission{submissions.length === 1 ? "" : "s"} collected so far.
          </p>

          {loading && <p className="mt-6 text-sm text-neutral-500">Loading…</p>}
          {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex flex-col gap-2">
            {submissions.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                  selectedId === s.id ? "border-neutral-900 bg-white" : "border-neutral-200 bg-white/50 hover:border-neutral-400"
                }`}
                onClick={() => setSelectedId(s.id)}
              >
                <p className="font-medium text-neutral-800">
                  {formatValue((s.answers["q1.main"] as Record<string, unknown>)?.["name"]) || "Unnamed"}
                </p>
                <p className="text-xs text-neutral-500">{new Date(s.submittedAt).toLocaleString()}</p>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 rounded-2xl border border-neutral-200 bg-white p-8">
          {!selected && !loading && <p className="text-neutral-500">No submissions yet.</p>}
          {selected && (
            <>
              <div className="mb-6 flex items-center justify-between border-b border-neutral-200 pb-4">
                <div>
                  <p className="text-xs text-neutral-400">Submitted</p>
                  <p className="text-sm font-medium text-neutral-800">{new Date(selected.submittedAt).toLocaleString()}</p>
                </div>
                <p className="font-mono text-xs text-neutral-400">{selected.id}</p>
              </div>
              <SubmissionTranscript submission={selected} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
