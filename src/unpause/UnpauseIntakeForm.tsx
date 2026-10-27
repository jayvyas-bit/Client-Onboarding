import { useState } from "react";
import { SECTIONS, INTRO, THANK_YOU } from "./content";
import type { AnswerPart, FieldSpec, QuestionPart, QuestionSpec } from "./types";

type ClientUploadFile = { name: string; size: number; dataUrl: string };
type ClientUploadValue = { text: string; files: ClientUploadFile[] };
type AnswerStore = Record<string, unknown>;

type Step = { kind: "intro" } | { kind: "section"; index: number } | { kind: "review" } | { kind: "done" };

function keyFor(questionId: string, partId: string) {
  return `${questionId}.${partId}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function FieldsInput({
  fields,
  value,
  onChange,
}: {
  fields: FieldSpec[];
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => (
        <label key={field.id} className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-600">{field.label}</span>
          <input
            type="text"
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none transition focus:border-neutral-900"
            placeholder={field.placeholder}
            value={value?.[field.id] ?? ""}
            onChange={(e) => onChange({ ...value, [field.id]: e.target.value })}
          />
        </label>
      ))}
    </div>
  );
}

function ShortTextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none transition focus:border-neutral-900"
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function LongTextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      rows={4}
      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none transition focus:border-neutral-900"
      placeholder={placeholder ?? "Type your answer..."}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function SingleSelectInput({
  options,
  allowOther,
  value,
  otherValue,
  onChange,
  onOtherChange,
}: {
  options: string[];
  allowOther?: boolean;
  value: string;
  otherValue: string;
  onChange: (next: string) => void;
  onOtherChange: (next: string) => void;
}) {
  const effectiveOptions = allowOther ? [...options, "Something else"] : options;
  return (
    <div className="flex flex-col gap-2">
      {effectiveOptions.map((option) => (
        <label
          key={option}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition ${
            value === option ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400"
          }`}
        >
          <input
            type="radio"
            className="h-4 w-4 accent-neutral-900"
            checked={value === option}
            onChange={() => onChange(option)}
          />
          <span className="text-neutral-800">{option}</span>
        </label>
      ))}
      {allowOther && value === "Something else" && (
        <input
          type="text"
          className="ml-7 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900"
          placeholder="Tell us more..."
          value={otherValue ?? ""}
          onChange={(e) => onOtherChange(e.target.value)}
        />
      )}
    </div>
  );
}

function MultiSelectInput({
  options,
  allowOther,
  maxSelect,
  value,
  otherValue,
  onChange,
  onOtherChange,
}: {
  options: string[];
  allowOther?: boolean;
  maxSelect?: number;
  value: string[];
  otherValue: string;
  onChange: (next: string[]) => void;
  onOtherChange: (next: string) => void;
}) {
  const effectiveOptions = allowOther ? [...options, "Something else"] : options;
  const selected = value ?? [];
  const atLimit = maxSelect !== undefined && selected.length >= maxSelect;

  function toggle(option: string) {
    if (selected.includes(option)) {
      onChange(selected.filter((o) => o !== option));
    } else if (!atLimit) {
      onChange([...selected, option]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {maxSelect && (
        <p className="text-xs text-neutral-500">
          {selected.length}/{maxSelect} selected
        </p>
      )}
      {effectiveOptions.map((option) => {
        const isChecked = selected.includes(option);
        const disabled = !isChecked && atLimit;
        return (
          <label
            key={option}
            className={`flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition ${
              isChecked ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-400"
            } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-neutral-900"
              checked={isChecked}
              disabled={disabled}
              onChange={() => toggle(option)}
            />
            <span className="text-neutral-800">{option}</span>
          </label>
        );
      })}
      {allowOther && selected.includes("Something else") && (
        <input
          type="text"
          className="ml-7 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-900"
          placeholder="Tell us more..."
          value={otherValue ?? ""}
          onChange={(e) => onOtherChange(e.target.value)}
        />
      )}
    </div>
  );
}

function ScalePairsInput({
  pairs,
  value,
  onChange,
}: {
  pairs: [string, string][];
  value: Record<number, number>;
  onChange: (next: Record<number, number>) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {pairs.map((pair, index) => (
        <div key={pair.join("-")} className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm text-neutral-600">
            <span>{pair[0]}</span>
            <span>{pair[1]}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            className="accent-neutral-900"
            value={value?.[index] ?? 50}
            onChange={(e) => onChange({ ...value, [index]: Number(e.target.value) })}
          />
        </div>
      ))}
    </div>
  );
}

function UploadOrTextInput({
  value,
  onChange,
  placeholder,
}: {
  value: ClientUploadValue;
  onChange: (next: ClientUploadValue) => void;
  placeholder?: string;
}) {
  const current = value ?? { text: "", files: [] };

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const newFiles: ClientUploadFile[] = [];
    for (const file of Array.from(fileList)) {
      const dataUrl = await fileToDataUrl(file);
      newFiles.push({ name: file.name, size: file.size, dataUrl });
    }
    onChange({ ...current, files: [...current.files, ...newFiles] });
  }

  function removeFile(name: string) {
    onChange({ ...current, files: current.files.filter((f) => f.name !== name) });
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        rows={3}
        className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-neutral-900 outline-none transition focus:border-neutral-900"
        placeholder={placeholder ?? "Paste links or describe it here..."}
        value={current.text}
        onChange={(e) => onChange({ ...current, text: e.target.value })}
      />
      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-600 transition hover:border-neutral-500">
        <span>+ Upload image(s)</span>
        <input
          type="file"
          accept="image/*,.pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
      {current.files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {current.files.map((f) => (
            <li key={f.name} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                className="text-neutral-400 transition hover:text-neutral-700"
                onClick={() => removeFile(f.name)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PartRenderer({
  part,
  value,
  otherValue,
  onChange,
  onOtherChange,
}: {
  part: AnswerPart;
  value: unknown;
  otherValue: string;
  onChange: (next: unknown) => void;
  onOtherChange: (next: string) => void;
}) {
  switch (part.kind) {
    case "fields":
      return (
        <FieldsInput
          fields={part.fields}
          value={(value as Record<string, string>) ?? {}}
          onChange={onChange}
        />
      );
    case "short-text":
      return <ShortTextInput value={(value as string) ?? ""} onChange={onChange} placeholder={part.placeholder} />;
    case "long-text":
      return <LongTextInput value={(value as string) ?? ""} onChange={onChange} placeholder={part.placeholder} />;
    case "single-select":
      return (
        <SingleSelectInput
          options={part.options}
          allowOther={part.allowOther}
          value={(value as string) ?? ""}
          otherValue={otherValue}
          onChange={onChange}
          onOtherChange={onOtherChange}
        />
      );
    case "multi-select":
      return (
        <MultiSelectInput
          options={part.options}
          allowOther={part.allowOther}
          maxSelect={part.maxSelect}
          value={(value as string[]) ?? []}
          otherValue={otherValue}
          onChange={onChange}
          onOtherChange={onOtherChange}
        />
      );
    case "scale-pairs":
      return (
        <ScalePairsInput
          pairs={part.pairs}
          value={(value as Record<number, number>) ?? {}}
          onChange={onChange}
        />
      );
    case "upload-or-text":
      return (
        <UploadOrTextInput
          value={(value as ClientUploadValue) ?? { text: "", files: [] }}
          onChange={onChange}
          placeholder={part.placeholder}
        />
      );
  }
}

function QuestionBlock({
  question,
  answers,
  setAnswer,
}: {
  question: QuestionSpec;
  answers: AnswerStore;
  setAnswer: (key: string, value: unknown) => void;
}) {
  return (
    <div className="flex flex-col gap-5 border-b border-neutral-200 pb-8 last:border-b-0 last:pb-0">
      <div>
        <p className="text-xs font-medium tracking-wide text-neutral-400">Q{question.number}</p>
        <h3 className="mt-1 text-lg font-medium text-neutral-900">{question.prompt}</h3>
        {question.helper && <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{question.helper}</p>}
      </div>
      {question.parts.map((qp: QuestionPart) => {
        const key = keyFor(question.id, qp.id);
        const otherKey = `${key}__other`;
        return (
          <div key={key} className="flex flex-col gap-2">
            {qp.label && <p className="text-sm font-medium text-neutral-700">{qp.label}</p>}
            {qp.helper && <p className="-mt-1 text-sm text-neutral-500">{qp.helper}</p>}
            <PartRenderer
              part={qp.part}
              value={answers[key]}
              otherValue={(answers[otherKey] as string) ?? ""}
              onChange={(v) => setAnswer(key, v)}
              onOtherChange={(v) => setAnswer(otherKey, v)}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function UnpauseIntakeForm() {
  const [step, setStep] = useState<Step>({ kind: "intro" });
  const [answers, setAnswers] = useState<AnswerStore>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function setAnswer(key: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToSection(index: number) {
    if (index < 0) {
      setStep({ kind: "intro" });
    } else if (index >= SECTIONS.length) {
      setStep({ kind: "review" });
    } else {
      setStep({ kind: "section", index });
    }
    scrollTop();
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/unpause/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "submit_failed");
      }
      setStep({ kind: "done" });
      scrollTop();
    } catch {
      setSubmitError("Something went wrong sending your answers. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const progress =
    step.kind === "section" ? Math.round(((step.index + 1) / (SECTIONS.length + 1)) * 100) : step.kind === "review" ? 95 : 0;

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {step.kind !== "intro" && step.kind !== "done" && (
        <div className="sticky top-0 z-10 h-1 w-full bg-neutral-200">
          <div className="h-full bg-neutral-900 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="mx-auto max-w-2xl px-6 py-16">
        {step.kind === "intro" && (
          <div className="flex flex-col gap-6">
            <p className="text-xs font-medium tracking-[0.2em] text-neutral-400">{INTRO.eyebrow}</p>
            <h1 className="text-3xl font-medium text-neutral-900 sm:text-4xl">{INTRO.title}</h1>
            {INTRO.body.map((p) => (
              <p key={p} className="text-neutral-600 leading-relaxed">
                {p}
              </p>
            ))}
            <p className="text-sm text-neutral-500">{INTRO.time}</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {INTRO.team.map((member) => (
                <div key={member.name} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <p className="font-medium text-neutral-900">{member.name}</p>
                  <p className="text-xs text-neutral-500">{member.role}</p>
                  <p className="mt-2 text-sm text-neutral-600">{member.line}</p>
                </div>
              ))}
            </div>
            <p className="text-sm italic text-neutral-500">{INTRO.teamNote}</p>

            <button
              type="button"
              className="mt-4 w-fit rounded-full bg-neutral-900 px-8 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
              onClick={() => goToSection(0)}
            >
              Ready? Let's begin
            </button>
          </div>
        )}

        {step.kind === "section" &&
          (() => {
            const section = SECTIONS[step.index];
            return (
              <div className="flex flex-col gap-10">
                <div>
                  <p className="text-xs font-medium tracking-[0.2em] text-neutral-400">
                    SECTION {section.number} / {String(SECTIONS.length).padStart(2, "0")}
                  </p>
                  <h2 className="mt-2 text-2xl font-medium text-neutral-900">{section.title}</h2>
                  <p className="mt-1 text-sm text-neutral-500">{section.host}</p>
                  {section.intro && <p className="mt-3 text-neutral-600 leading-relaxed">{section.intro}</p>}
                </div>

                <div className="flex flex-col gap-8">
                  {section.questions.map((question) => (
                    <QuestionBlock key={question.id} question={question} answers={answers} setAnswer={setAnswer} />
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
                    onClick={() => goToSection(step.index - 1)}
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-neutral-900 px-8 py-3 text-sm font-medium text-white transition hover:bg-neutral-700"
                    onClick={() => goToSection(step.index + 1)}
                  >
                    {step.index === SECTIONS.length - 1 ? "Review your answers" : "Continue"}
                  </button>
                </div>
              </div>
            );
          })()}

        {step.kind === "review" && (
          <div className="flex flex-col gap-6">
            <p className="text-xs font-medium tracking-[0.2em] text-neutral-400">BEFORE YOU GO.</p>
            <h2 className="text-2xl font-medium text-neutral-900">One last look.</h2>
            <p className="text-neutral-600 leading-relaxed">Here's a summary of what you've shared with us:</p>
            <ul className="list-disc pl-5 text-neutral-600">
              <li>Your brand and what you do</li>
              <li>What you're looking to create</li>
              <li>What matters most</li>
              <li>Your creative direction and references</li>
              <li>What you'll need delivered</li>
              <li>Your preferred timeline</li>
              <li>Your investment range and budget ceiling</li>
            </ul>
            <p className="text-sm text-neutral-500">
              You can go back to review or change any of your answers before submitting.
            </p>

            {submitError && <p className="text-sm text-red-600">{submitError}</p>}

            <div className="flex items-center justify-between">
              <button
                type="button"
                className="text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
                onClick={() => goToSection(SECTIONS.length - 1)}
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={submitting}
                className="rounded-full bg-neutral-900 px-8 py-3 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
                onClick={handleSubmit}
              >
                {submitting ? "Submitting..." : "Submit The Unbrief"}
              </button>
            </div>
          </div>
        )}

        {step.kind === "done" && (
          <div className="flex flex-col gap-5 py-10 text-center">
            <p className="text-xs font-medium tracking-[0.2em] text-neutral-400">THANK YOU.</p>
            <h2 className="text-2xl font-medium text-neutral-900">{THANK_YOU.title}</h2>
            {THANK_YOU.body.map((p) => (
              <p key={p} className="text-neutral-600 leading-relaxed">
                {p}
              </p>
            ))}
            <p className="mt-2 font-medium text-neutral-900">{THANK_YOU.cta}</p>
            <p className="text-sm text-neutral-500">{THANK_YOU.signoff}</p>
            <p className="mt-6 text-sm tracking-wide text-neutral-400">— Unpause</p>
          </div>
        )}
      </div>
    </div>
  );
}
