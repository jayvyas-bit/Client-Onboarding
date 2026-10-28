import { useEffect, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "motion/react";
import { upload } from "@vercel/blob/client";
import { INTRO, SECTIONS, THANK_YOU } from "./content";
import { QUESTION_ORDINALS, SLIDES, TOTAL_QUESTIONS } from "./flow";
import type { Slide } from "./flow";
import MicButton from "./MicButton";
import type { AnswerPart, FieldSpec, UploadOrTextValue } from "./types";

type AnswerStore = Record<string, unknown>;

type Step = { kind: "intro" } | { kind: "slide"; index: number } | { kind: "review" } | { kind: "done" };

const EASE = [0.16, 1, 0.3, 1] as const;

const UNDERLINE_INPUT =
  "w-full border-b-2 border-neutral-300 bg-transparent px-0.5 pb-2.5 pt-1 text-lg text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 placeholder:italic focus:border-neutral-900";

const EYEBROW_LABEL = "text-xs font-medium tracking-[0.2em] text-neutral-400";

function keyFor(questionId: string, partId: string) {
  return `${questionId}.${partId}`;
}

function stepPosition(step: Step): number {
  if (step.kind === "intro") return -1;
  if (step.kind === "slide") return step.index;
  if (step.kind === "review") return SLIDES.length;
  return SLIDES.length + 1;
}

function isTypingTarget(el: Element | null): boolean {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DRAFT_KEY = "unpause-intake-draft-v1";

function loadDraft(): { step: Step; answers: AnswerStore } | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof parsed.answers !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function restoreStep(draft: { step: Step; answers: AnswerStore } | null): Step {
  const s = draft?.step;
  if (!s || typeof s !== "object" || typeof (s as { kind?: unknown }).kind !== "string") {
    return { kind: "intro" };
  }
  if (s.kind === "slide" && typeof (s as { index?: unknown }).index === "number") {
    const maxIndex = Math.max(SLIDES.length - 1, 0);
    return { kind: "slide", index: Math.min(Math.max((s as { index: number }).index, 0), maxIndex) };
  }
  if (s.kind === "intro" || s.kind === "review" || s.kind === "done") return s;
  return { kind: "intro" };
}

function isFieldValid(field: FieldSpec, raw: string): boolean {
  const trimmed = raw.trim();
  if (!field.required) return true;
  if (!trimmed) return false;
  if (field.type === "email") return EMAIL_PATTERN.test(trimmed);
  return true;
}

function isSlideComplete(slide: Slide | null, answers: AnswerStore): boolean {
  if (!slide || slide.kind !== "question") return true;
  return slide.question.parts.every((part) => {
    if (part.part.kind !== "fields") return true;
    const key = keyFor(slide.question.id, part.id);
    const value = (answers[key] as Record<string, string>) ?? {};
    return part.part.fields.every((field) => isFieldValid(field, value[field.id] ?? ""));
  });
}

function formatAnswerValue(part: AnswerPart, value: unknown, otherValue: string): string | null {
  switch (part.kind) {
    case "fields": {
      const v = (value as Record<string, string>) ?? {};
      const filled = part.fields.map((f) => v[f.id]?.trim()).filter((s): s is string => Boolean(s));
      return filled.length ? filled.join(" · ") : null;
    }
    case "short-text":
    case "long-text": {
      const v = ((value as string) ?? "").trim();
      return v || null;
    }
    case "single-select": {
      const v = (value as string) ?? "";
      if (!v) return null;
      return v === "Something else" ? otherValue.trim() || v : v;
    }
    case "multi-select": {
      const v = (value as string[]) ?? [];
      if (!v.length) return null;
      return v.map((o) => (o === "Something else" ? otherValue.trim() || o : o)).join(", ");
    }
    case "scale-pairs": {
      const v = (value as Record<number, number>) ?? {};
      const entries = part.pairs
        .map((pair, i) => (v[i] !== undefined ? `${pair[0]} ↔ ${pair[1]}: ${v[i]}` : null))
        .filter((s): s is string => Boolean(s));
      return entries.length ? entries.join(" · ") : null;
    }
    case "upload-or-text": {
      const v = (value as UploadOrTextValue) ?? { text: "", files: [] };
      const bits: string[] = [];
      if (v.text?.trim()) bits.push(v.text.trim());
      if (v.files?.length) bits.push(`${v.files.length} file${v.files.length > 1 ? "s" : ""} attached`);
      return bits.length ? bits.join(" · ") : null;
    }
  }
}

function useOptionShortcuts(
  options: string[],
  onSelect: (option: string) => void,
  containerRef: RefObject<HTMLElement | null>,
) {
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const active = document.activeElement;
      if (isTypingTarget(active)) return;
      const withinGroup = active === document.body || containerRef.current?.contains(active) === true;
      if (!withinGroup) return;
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < options.length) onSelectRef.current(options[idx]);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // onSelectRef keeps the handler current, so only the option set needs to retrigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.join("|")]);
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
    <div className="grid gap-5 sm:grid-cols-2">
      {fields.map((field) => {
        const raw = value?.[field.id] ?? "";
        const invalid = field.required && raw.trim().length > 0 && !isFieldValid(field, raw);
        return (
          <label key={field.id} className="flex flex-col gap-1.5 text-sm">
            <span className="text-neutral-500">
              {field.label}
              {field.required && (
                <span className="text-neutral-400" aria-hidden="true">
                  {" "}
                  *
                </span>
              )}
            </span>
            <input
              type={field.type === "email" ? "email" : "text"}
              className={UNDERLINE_INPUT + " text-base"}
              placeholder={field.placeholder}
              value={raw}
              aria-required={field.required || undefined}
              aria-invalid={invalid || undefined}
              onChange={(e) => onChange({ ...value, [field.id]: e.target.value })}
            />
            {invalid && <span className="text-xs text-red-600">Enter a valid email address.</span>}
          </label>
        );
      })}
    </div>
  );
}

function ShortTextInput({
  value,
  onChange,
  placeholder,
  onAdvance,
  labelledBy,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  onAdvance?: () => void;
  labelledBy?: string;
}) {
  return (
    <div className="flex items-end gap-3">
      <input
        type="text"
        className={UNDERLINE_INPUT}
        placeholder={placeholder}
        value={value ?? ""}
        aria-labelledby={labelledBy}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdvance?.();
          }
        }}
      />
      <MicButton onTranscript={(text) => onChange(value ? `${value} ${text}` : text)} />
    </div>
  );
}

function LongTextInput({
  value,
  onChange,
  placeholder,
  labelledBy,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  labelledBy?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <textarea
        rows={4}
        className={UNDERLINE_INPUT + " resize-none"}
        placeholder={placeholder ?? "Type your answer..."}
        value={value ?? ""}
        aria-labelledby={labelledBy}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex items-center gap-2.5">
        <MicButton onTranscript={(text) => onChange(value ? `${value} ${text}` : text)} />
        <span className="text-xs text-neutral-400">Or tap to speak your answer</span>
      </div>
    </div>
  );
}

function AnimatedOrdinal({ value }: { value: number }) {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) return <span className="tabular-nums">{value}</span>;

  const digits = String(value).split("");
  return (
    <span className="inline-flex tabular-nums">
      <AnimatePresence mode="popLayout" initial={false}>
        {digits.map((digit, i) => (
          <motion.span
            key={`${value}-${i}`}
            initial={{ y: 8, opacity: 0, filter: "blur(3px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ y: -8, opacity: 0, filter: "blur(3px)" }}
            transition={{ duration: 0.22, delay: i * 0.03, ease: EASE }}
            className="inline-block"
          >
            {digit}
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}

function OptionRow({
  index,
  label,
  selected,
  shape,
  disabled,
  role,
  onSelect,
}: {
  index: number;
  label: string;
  selected: boolean;
  shape: "circle" | "square";
  disabled?: boolean;
  role: "radio" | "checkbox";
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      role={role}
      aria-checked={selected}
      onClick={onSelect}
      whileHover={disabled ? undefined : { x: 4 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 500, damping: 32 }}
      className={`group flex w-full items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left transition-colors ${
        selected
          ? "border-neutral-900 bg-neutral-900/[0.04]"
          : "border-neutral-200 bg-white/70 hover:border-neutral-400"
      } ${disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"}`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center text-xs font-medium transition-colors ${
          shape === "circle" ? "rounded-full" : "rounded-md"
        } ${
          selected
            ? "border border-neutral-900 bg-neutral-900 text-white"
            : "border border-neutral-300 text-neutral-400 group-hover:border-neutral-500 group-hover:text-neutral-600"
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {selected ? (
            <motion.svg
              key="check"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.15 }}
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <motion.polyline
                points="20 6 9 17 4 12"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.25, delay: 0.05, ease: EASE }}
              />
            </motion.svg>
          ) : (
            <motion.span
              key="index"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {index + 1}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className="text-[15px] text-neutral-800">{label}</span>
    </motion.button>
  );
}

function OtherTextField({
  value,
  onChange,
  onAdvance,
}: {
  value: string;
  onChange: (next: string) => void;
  onAdvance?: () => void;
}) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: EASE }}
      className="overflow-hidden"
    >
      <input
        type="text"
        className="ml-10 w-[calc(100%-2.5rem)] border-b-2 border-neutral-300 bg-transparent px-0.5 pb-2 pt-3 text-sm text-neutral-900 outline-none transition-colors focus:border-neutral-900"
        placeholder="Tell us more..."
        aria-label="Something else — please specify"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdvance?.();
          }
        }}
      />
    </motion.div>
  );
}

function SingleSelectInput({
  options,
  allowOther,
  value,
  otherValue,
  onChange,
  onOtherChange,
  onAdvance,
  labelledBy,
}: {
  options: string[];
  allowOther?: boolean;
  value: string;
  otherValue: string;
  onChange: (next: string) => void;
  onOtherChange: (next: string) => void;
  onAdvance?: () => void;
  labelledBy?: string;
}) {
  const effectiveOptions = allowOther ? [...options, "Something else"] : options;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  function handleSelect(option: string) {
    onChange(option);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (onAdvance && option !== "Something else") {
      timeoutRef.current = setTimeout(() => onAdvance(), 350);
    }
  }

  useOptionShortcuts(effectiveOptions, handleSelect, containerRef);

  return (
    <div ref={containerRef} role="radiogroup" aria-labelledby={labelledBy} className="flex flex-col gap-2.5">
      {effectiveOptions.map((option, index) => (
        <OptionRow
          key={option}
          index={index}
          label={option}
          shape="circle"
          role="radio"
          selected={value === option}
          onSelect={() => handleSelect(option)}
        />
      ))}
      <AnimatePresence initial={false}>
        {allowOther && value === "Something else" && (
          <OtherTextField value={otherValue} onChange={onOtherChange} onAdvance={onAdvance} />
        )}
      </AnimatePresence>
      {effectiveOptions.length <= 9 && (
        <p className="pt-1 text-xs text-neutral-400">Tip: press a number key to jump ahead</p>
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
  onAdvance,
  labelledBy,
}: {
  options: string[];
  allowOther?: boolean;
  maxSelect?: number;
  value: string[];
  otherValue: string;
  onChange: (next: string[]) => void;
  onOtherChange: (next: string) => void;
  onAdvance?: () => void;
  labelledBy?: string;
}) {
  const effectiveOptions = allowOther ? [...options, "Something else"] : options;
  const selected = value ?? [];
  const atLimit = maxSelect !== undefined && selected.length >= maxSelect;
  const containerRef = useRef<HTMLDivElement>(null);

  function toggle(option: string) {
    if (selected.includes(option)) {
      onChange(selected.filter((o) => o !== option));
    } else if (!atLimit) {
      onChange([...selected, option]);
    }
  }

  useOptionShortcuts(effectiveOptions, toggle, containerRef);

  return (
    <div ref={containerRef} role="group" aria-labelledby={labelledBy} className="flex flex-col gap-2.5">
      {maxSelect && (
        <p className="text-xs text-neutral-500" aria-live="polite">
          {selected.length}/{maxSelect} selected
        </p>
      )}
      {effectiveOptions.map((option, index) => {
        const isChecked = selected.includes(option);
        return (
          <OptionRow
            key={option}
            index={index}
            label={option}
            shape="square"
            role="checkbox"
            selected={isChecked}
            disabled={!isChecked && atLimit}
            onSelect={() => toggle(option)}
          />
        );
      })}
      <AnimatePresence initial={false}>
        {allowOther && selected.includes("Something else") && (
          <OtherTextField value={otherValue} onChange={onOtherChange} onAdvance={onAdvance} />
        )}
      </AnimatePresence>
      {effectiveOptions.length <= 9 && (
        <p className="pt-1 text-xs text-neutral-400">Tip: press a number key to toggle an option</p>
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
    <div className="flex flex-col gap-8">
      {pairs.map((pair, index) => {
        const v = value?.[index] ?? 50;
        return (
          <div key={pair.join("-")} className="flex flex-col gap-3">
            <div className="flex justify-between text-sm text-neutral-600">
              <span>{pair[0]}</span>
              <span>{pair[1]}</span>
            </div>
            <div className="relative pt-6">
              <motion.div
                initial={false}
                animate={{ left: `${v}%` }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-medium text-white"
              >
                {v}
              </motion.div>
              <input
                type="range"
                min={0}
                max={100}
                value={v}
                aria-label={`${pair[0]} to ${pair[1]}`}
                aria-valuetext={`${v} out of 100, closer to ${v >= 50 ? pair[1] : pair[0]}`}
                onChange={(e) => onChange({ ...value, [index]: Number(e.target.value) })}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 accent-neutral-900"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UploadOrTextInput({
  value,
  onChange,
  placeholder,
  labelledBy,
}: {
  value: UploadOrTextValue;
  onChange: (next: UploadOrTextValue) => void;
  placeholder?: string;
  labelledBy?: string;
}) {
  const current = value ?? { text: "", files: [] };
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await Promise.all(
        Array.from(fileList).map(async (file) => {
          const blob = await upload(file.name, file, {
            access: "public",
            handleUploadUrl: "/api/unpause/upload",
          });
          return { name: file.name, size: file.size, path: blob.url };
        }),
      );
      onChange({ ...current, files: [...current.files, ...uploaded] });
    } catch {
      setUploadError("Couldn't upload that file. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function removeFile(name: string) {
    onChange({ ...current, files: current.files.filter((f) => f.name !== name) });
  }

  return (
    <div className="flex flex-col gap-4">
      <textarea
        rows={3}
        className={UNDERLINE_INPUT + " resize-none"}
        placeholder={placeholder ?? "Paste links or describe it here..."}
        value={current.text}
        aria-labelledby={labelledBy}
        onChange={(e) => onChange({ ...current, text: e.target.value })}
      />
      <div className="flex flex-wrap items-center gap-3">
        <motion.label
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="flex w-fit cursor-pointer items-center gap-2 rounded-full border border-dashed border-neutral-300 px-4 py-2.5 text-sm text-neutral-600 transition-colors hover:border-neutral-500"
        >
          <span>{uploading ? "Uploading..." : "+ Upload image(s)"}</span>
          <input
            type="file"
            accept="image/*,.pdf"
            multiple
            disabled={uploading}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </motion.label>
        <MicButton
          onTranscript={(text) => onChange({ ...current, text: current.text ? `${current.text} ${text}` : text })}
        />
      </div>
      {uploadError && (
        <p className="text-sm text-red-600" role="alert">
          {uploadError}
        </p>
      )}
      <AnimatePresence initial={false}>
        {current.files.length > 0 && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-1.5 overflow-hidden"
          >
            {current.files.map((f) => (
              <motion.li
                key={f.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between rounded-lg bg-neutral-100/70 px-3 py-2 text-sm text-neutral-700"
              >
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  className="text-neutral-400 transition hover:text-neutral-700"
                  onClick={() => removeFile(f.name)}
                >
                  Remove
                </button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function PartRenderer({
  part,
  value,
  otherValue,
  onChange,
  onOtherChange,
  onAdvance,
  headingId,
}: {
  part: AnswerPart;
  value: unknown;
  otherValue: string;
  onChange: (next: unknown) => void;
  onOtherChange: (next: string) => void;
  onAdvance?: () => void;
  headingId: string;
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
      return (
        <ShortTextInput
          value={(value as string) ?? ""}
          onChange={onChange}
          placeholder={part.placeholder}
          onAdvance={onAdvance}
          labelledBy={headingId}
        />
      );
    case "long-text":
      return (
        <LongTextInput
          value={(value as string) ?? ""}
          onChange={onChange}
          placeholder={part.placeholder}
          labelledBy={headingId}
        />
      );
    case "single-select":
      return (
        <SingleSelectInput
          options={part.options}
          allowOther={part.allowOther}
          value={(value as string) ?? ""}
          otherValue={otherValue}
          onChange={onChange}
          onOtherChange={onOtherChange}
          onAdvance={onAdvance}
          labelledBy={headingId}
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
          onAdvance={onAdvance}
          labelledBy={headingId}
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
          value={(value as UploadOrTextValue) ?? { text: "", files: [] }}
          onChange={onChange}
          placeholder={part.placeholder}
          labelledBy={headingId}
        />
      );
  }
}

const teamContainerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};

const teamItemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export default function UnpauseIntakeForm() {
  const [step, setStep] = useState<Step>(() => restoreStep(loadDraft()));
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<AnswerStore>(() => loadDraft()?.answers ?? {});
  const [submitting, setSubmitting] = useState(false);
  const [submitSucceeded, setSubmitSucceeded] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const continueControls = useAnimationControls();

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, answers }));
    } catch {
      // Storage unavailable (private browsing, quota) — the draft just won't persist.
    }
  }, [step, answers]);

  function setAnswer(key: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function transitionTo(next: Step) {
    setDirection(stepPosition(next) >= stepPosition(step) ? 1 : -1);
    setStep(next);
  }

  function goTo(index: number) {
    if (index < 0) {
      transitionTo({ kind: "intro" });
    } else if (index >= SLIDES.length) {
      transitionTo({ kind: "review" });
    } else {
      transitionTo({ kind: "slide", index });
    }
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
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
      setSubmitting(false);
      setSubmitSucceeded(true);
      await new Promise((resolve) => setTimeout(resolve, shouldReduceMotion ? 0 : 550));
      transitionTo({ kind: "done" });
    } catch {
      setSubmitting(false);
      setSubmitError("Something went wrong sending your answers. Please try again.");
    }
  }

  useEffect(() => {
    if (step.kind !== "slide") return;
    const el = slideRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      "input[type=text], input[type=email], textarea",
    );
    const id = requestAnimationFrame(() => el?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
  }, [step]);

  const currentOrdinal =
    step.kind === "slide"
      ? QUESTION_ORDINALS[step.index]
      : step.kind === "review" || step.kind === "done"
        ? TOTAL_QUESTIONS
        : 0;
  const progress = TOTAL_QUESTIONS === 0 ? 0 : Math.round((currentOrdinal / TOTAL_QUESTIONS) * 100);

  const stepKey = step.kind === "slide" ? `slide-${step.index}` : step.kind;
  const slide = step.kind === "slide" ? SLIDES[step.index] : null;
  const canAdvance = isSlideComplete(slide, answers);
  const lastPart = slide?.kind === "question" ? slide.question.parts[slide.question.parts.length - 1] : null;
  const showEnterHint = lastPart?.part.kind === "short-text";

  const slideVariants = {
    enter: (dir: number) =>
      shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: dir >= 0 ? 32 : -32 },
    center: {
      opacity: 1,
      x: 0,
      transition: shouldReduceMotion
        ? { duration: 0.4, ease: EASE }
        : { duration: 0.4, ease: EASE, staggerChildren: 0.06, delayChildren: 0.08 },
    },
    exit: (dir: number) =>
      shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: dir >= 0 ? -32 : 32 },
  };

  const textItemVariants = {
    enter: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 },
    center: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
  };

  const reviewSections = SECTIONS.map((section) => {
    const items = section.questions.flatMap((question) =>
      question.parts
        .map((part) => {
          const key = keyFor(question.id, part.id);
          const otherVal = (answers[`${key}__other`] as string) ?? "";
          const display = formatAnswerValue(part.part, answers[key], otherVal);
          if (!display) return null;
          return { label: part.label ?? question.prompt, display };
        })
        .filter((item): item is { label: string; display: string } => item !== null),
    );
    return { section, items };
  }).filter((entry) => entry.items.length > 0);

  const liveAnnouncement =
    step.kind === "slide" && slide
      ? slide.kind === "divider"
        ? `Section ${slide.section.number}: ${slide.section.title}`
        : `Question ${QUESTION_ORDINALS[step.index]} of ${TOTAL_QUESTIONS}: ${slide.question.prompt}`
      : step.kind === "review"
        ? "Review your answers before submitting."
        : step.kind === "done"
          ? "Submission complete. Thank you."
          : "";

  return (
    <div className="relative min-h-dvh bg-[#faf8f5]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-neutral-900/[0.04] blur-3xl"
          animate={shouldReduceMotion ? undefined : { x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-neutral-900/[0.03] blur-3xl"
          animate={shouldReduceMotion ? undefined : { x: [0, -20, 0], y: [0, -30, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {(step.kind === "slide" || step.kind === "review") && (
        <div className="fixed inset-x-0 top-0 z-20 h-[3px] bg-neutral-900/10">
          <motion.div
            className="h-full bg-[#004ac7]"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 220, damping: 30 }}
          />
        </div>
      )}

      <div className="relative z-10 flex min-h-dvh flex-col">
        <div aria-live="polite" className="sr-only">
          {liveAnnouncement}
        </div>
        <div className="pt-6 text-center sm:pt-8">
          <span className="text-sm font-semibold tracking-[0.3em] text-neutral-900">UNPAUSE</span>
        </div>
        <div className="flex flex-1 items-start justify-center px-6 py-10 sm:px-10 sm:py-14">
          <div className="w-full max-w-4xl rounded-3xl border border-neutral-900/5 bg-[#fffefb] p-8 shadow-[0_8px_40px_rgba(0,0,0,0.06)] sm:p-12">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={stepKey}
                ref={slideRef}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: EASE }}
              >
                {step.kind === "intro" && (
                  <div className="flex flex-col gap-6">
                    <div className="max-w-prose">
                      <motion.p
                        variants={textItemVariants}
                        className={EYEBROW_LABEL}
                      >
                        {INTRO.eyebrow}
                      </motion.p>
                      <motion.h1
                        variants={textItemVariants}
                        className="mt-2 text-3xl font-medium text-neutral-900 sm:text-4xl"
                      >
                        {INTRO.title}
                      </motion.h1>
                      <div className="mt-4 flex flex-col gap-4">
                        {INTRO.body.map((p) => (
                          <motion.p key={p} variants={textItemVariants} className="text-neutral-600 leading-relaxed">
                            {p}
                          </motion.p>
                        ))}
                      </div>
                      <motion.p variants={textItemVariants} className="mt-4 text-sm text-neutral-500">
                        {INTRO.time}
                      </motion.p>
                    </div>

                    <motion.div
                      variants={teamContainerVariants}
                      initial="hidden"
                      animate="show"
                      className="mt-4 grid gap-4 sm:grid-cols-3"
                    >
                      {INTRO.team.map((member) => (
                        <motion.div
                          key={member.name}
                          variants={teamItemVariants}
                          transition={{ type: "spring", stiffness: 300, damping: 24 }}
                          className="rounded-xl border border-neutral-200 bg-white/70 p-4 shadow-sm"
                        >
                          <p className="font-medium text-neutral-900">{member.name}</p>
                          <p className="text-xs text-neutral-500">{member.role}</p>
                          <p className="mt-2 text-sm text-neutral-600">{member.line}</p>
                        </motion.div>
                      ))}
                    </motion.div>
                    <motion.p variants={textItemVariants} className="text-sm italic text-neutral-500">
                      {INTRO.teamNote}
                    </motion.p>

                    <motion.button
                      type="button"
                      variants={textItemVariants}
                      whileHover={{ y: -2, boxShadow: "0 12px 30px rgba(0,0,0,0.14)" }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 400, damping: 26 }}
                      className="mt-4 w-fit rounded-full bg-[#01213B] px-8 py-3 text-sm font-medium text-white"
                      onClick={() => goTo(0)}
                    >
                      Ready? Let's begin
                    </motion.button>
                  </div>
                )}

                {step.kind === "slide" &&
                  slide &&
                  (() => {
                    const ordinal = QUESTION_ORDINALS[step.index];
                    return (
                      <div className="flex flex-col gap-8">
                        {slide.kind === "divider" ? (
                          <div className="flex max-w-prose flex-col gap-4">
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: 28 }}
                              transition={{ duration: 0.4, ease: EASE }}
                              className="w-0.5 rounded-full bg-neutral-900/30"
                            />
                            <motion.p
                              variants={textItemVariants}
                              className={EYEBROW_LABEL}
                            >
                              SECTION {slide.section.number} / {String(SECTIONS.length).padStart(2, "0")}
                            </motion.p>
                            <motion.h2
                              variants={textItemVariants}
                              className="text-3xl font-medium text-neutral-900 sm:text-4xl"
                            >
                              {slide.section.title}
                            </motion.h2>
                            <motion.p variants={textItemVariants} className="text-sm text-neutral-500">
                              {slide.section.host}
                            </motion.p>
                            {slide.section.intro && (
                              <motion.p variants={textItemVariants} className="text-neutral-600 leading-relaxed">
                                {slide.section.intro}
                              </motion.p>
                            )}
                          </div>
                        ) : (
                          (() => {
                            const { question } = slide;
                            const mainHeadingId = `heading-${question.id}`;
                            return (
                              <div className="flex flex-col gap-8">
                                <div className="max-w-prose">
                                  <motion.p
                                    variants={textItemVariants}
                                    className={EYEBROW_LABEL}
                                  >
                                    QUESTION <AnimatedOrdinal value={ordinal} /> OF {TOTAL_QUESTIONS}
                                  </motion.p>
                                  <motion.h2
                                    variants={textItemVariants}
                                    id={mainHeadingId}
                                    className="mt-2 text-2xl font-medium text-neutral-900 sm:text-3xl"
                                  >
                                    {question.prompt}
                                  </motion.h2>
                                  {question.helper && (
                                    <motion.p
                                      variants={textItemVariants}
                                      className="mt-2 text-neutral-500 leading-relaxed"
                                    >
                                      {question.helper}
                                    </motion.p>
                                  )}
                                </div>
                                {question.parts.map((part, i) => {
                                  const key = keyFor(question.id, part.id);
                                  const otherKey = `${key}__other`;
                                  const isLast = i === question.parts.length - 1;
                                  const partHeadingId = i === 0 ? mainHeadingId : `heading-${key}`;
                                  return (
                                    <motion.div
                                      key={part.id}
                                      variants={textItemVariants}
                                      className={
                                        i > 0
                                          ? "flex flex-col gap-4 border-t border-neutral-900/10 pt-6"
                                          : "flex flex-col gap-4"
                                      }
                                    >
                                      {i > 0 && part.label && (
                                        <div>
                                          <h3 id={partHeadingId} className="text-lg font-medium text-neutral-800">
                                            {part.label}
                                          </h3>
                                          {part.helper && (
                                            <p className="mt-1 text-sm text-neutral-500">{part.helper}</p>
                                          )}
                                        </div>
                                      )}
                                      <PartRenderer
                                        part={part.part}
                                        value={answers[key]}
                                        otherValue={(answers[otherKey] as string) ?? ""}
                                        onChange={(v) => setAnswer(key, v)}
                                        onOtherChange={(v) => setAnswer(otherKey, v)}
                                        onAdvance={isLast ? () => goTo(step.index + 1) : undefined}
                                        headingId={partHeadingId}
                                      />
                                    </motion.div>
                                  );
                                })}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    );
                  })()}

                {step.kind === "review" && (
                  <div className="flex flex-col gap-6">
                    <motion.p variants={textItemVariants} className={EYEBROW_LABEL}>
                      BEFORE YOU GO.
                    </motion.p>
                    <motion.h2
                      variants={textItemVariants}
                      className="text-2xl font-medium text-neutral-900 sm:text-3xl"
                    >
                      One last look.
                    </motion.h2>
                    <motion.p variants={textItemVariants} className="text-neutral-600 leading-relaxed">
                      Here's what you've shared with us so far:
                    </motion.p>
                    <motion.div variants={textItemVariants} className="flex flex-col gap-5">
                      {reviewSections.map(({ section, items }, i) => (
                        <div
                          key={section.id}
                          className={
                            i > 0
                              ? "flex flex-col gap-2.5 border-t border-neutral-900/10 pt-5"
                              : "flex flex-col gap-2.5"
                          }
                        >
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-[#004ac7]">
                            {section.title}
                          </h3>
                          <dl className="flex flex-col gap-2">
                            {items.map((item, j) => (
                              <div key={j} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
                                <dt className="text-sm text-neutral-500 sm:w-56 sm:shrink-0">{item.label}</dt>
                                <dd className="text-sm font-medium text-neutral-800">{item.display}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      ))}
                    </motion.div>
                    <motion.p variants={textItemVariants} className="text-sm text-neutral-500">
                      You can go back to review or change any of your answers before submitting.
                    </motion.p>
                    {submitError && (
                      <motion.p variants={textItemVariants} className="text-sm text-red-600" role="alert">
                        {submitError}
                      </motion.p>
                    )}
                  </div>
                )}

                {step.kind === "done" && (
                  <div className="flex flex-col gap-8 py-10 text-center">
                    <motion.svg
                      width="64"
                      height="64"
                      viewBox="0 0 64 64"
                      className="mx-auto text-[#004ac7]"
                    >
                      <motion.circle
                        cx="32"
                        cy="32"
                        r="30"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.6, ease: EASE }}
                      />
                      <motion.path
                        d="M20 33 L28 41 L44 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 0.4, delay: 0.5, ease: EASE }}
                      />
                    </motion.svg>
                    <div className="flex flex-col gap-3">
                      <motion.p variants={textItemVariants} className={EYEBROW_LABEL}>
                        THANK YOU.
                      </motion.p>
                      <motion.h2
                        variants={textItemVariants}
                        className="text-2xl font-medium text-neutral-900 sm:text-3xl"
                      >
                        {THANK_YOU.title}
                      </motion.h2>
                    </div>
                    <div className="mx-auto flex max-w-md flex-col gap-4">
                      {THANK_YOU.body.map((p, i) => (
                        <motion.p
                          key={p}
                          variants={textItemVariants}
                          className={i === 0 ? "text-lg text-neutral-800 leading-relaxed" : "text-neutral-600 leading-relaxed"}
                        >
                          {p}
                        </motion.p>
                      ))}
                    </div>
                    <div className="flex flex-col gap-1">
                      <motion.p variants={textItemVariants} className="font-medium text-[#004ac7]">
                        {THANK_YOU.cta}
                      </motion.p>
                      <motion.p variants={textItemVariants} className="text-sm text-neutral-500">
                        {THANK_YOU.signoff}
                      </motion.p>
                    </div>
                    <motion.p variants={textItemVariants} className="text-sm tracking-wide text-neutral-400">
                      — Unpause
                    </motion.p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {(step.kind === "slide" || step.kind === "review") && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-900/5 bg-[#faf8f5]/85 backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4 sm:px-10">
            <button
              type="button"
              className="-m-2 p-2 text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
              onClick={() => (step.kind === "slide" ? goTo(step.index - 1) : goTo(SLIDES.length - 1))}
            >
              ← Back
            </button>
            <div className="flex items-center gap-3">
              {step.kind === "slide" && !canAdvance && (
                <span className="hidden text-xs text-neutral-400 sm:inline">Name and email are required</span>
              )}
              {step.kind === "slide" && canAdvance && showEnterHint && (
                <span className="hidden text-xs text-neutral-400 sm:inline">press Enter ↵</span>
              )}
              <motion.button
                type="button"
                disabled={step.kind === "review" && (submitting || submitSucceeded)}
                animate={continueControls}
                whileHover={
                  (step.kind === "review" && (submitting || submitSucceeded)) ||
                  (step.kind === "slide" && !canAdvance)
                    ? undefined
                    : { y: -2, boxShadow: "0 12px 30px rgba(0,0,0,0.14)" }
                }
                whileTap={step.kind === "review" && (submitting || submitSucceeded) ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 26 }}
                className={`flex items-center gap-2 rounded-full bg-[#01213B] px-8 py-3 text-sm font-medium text-white disabled:cursor-not-allowed ${
                  step.kind === "slide" && !canAdvance ? "cursor-not-allowed opacity-40" : ""
                } disabled:opacity-40`}
                onClick={() => {
                  if (step.kind === "slide" && !canAdvance) {
                    if (!shouldReduceMotion) {
                      continueControls.start({
                        x: [0, -8, 8, -6, 6, -3, 3, 0],
                        transition: { duration: 0.4, ease: [0.36, 0.07, 0.19, 0.97] },
                      });
                    }
                    return;
                  }
                  if (step.kind === "review") {
                    handleSubmit();
                  } else {
                    goTo(step.index + 1);
                  }
                }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {step.kind === "review" && submitting && (
                    <motion.svg
                      key="spinner"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1, rotate: 360 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{
                        opacity: { duration: 0.15 },
                        scale: { duration: 0.15 },
                        rotate: shouldReduceMotion
                          ? { duration: 0 }
                          : { duration: 0.7, repeat: Infinity, ease: "linear" },
                      }}
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                      <path
                        d="M21 12a9 9 0 0 0-9-9"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </motion.svg>
                  )}
                  {step.kind === "review" && submitSucceeded && (
                    <motion.svg
                      key="check"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.6 }}
                      transition={{ duration: 0.2 }}
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <motion.polyline
                        points="20 6 9 17 4 12"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.3, ease: EASE }}
                      />
                    </motion.svg>
                  )}
                </AnimatePresence>
                <span>
                  {step.kind === "review"
                    ? submitSucceeded
                      ? "Sent!"
                      : submitting
                        ? "Submitting..."
                        : "Submit The Unbrief"
                    : step.index === SLIDES.length - 1
                      ? "Review your answers"
                      : "Continue"}
                </span>
              </motion.button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
