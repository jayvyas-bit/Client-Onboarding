import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "motion/react";
import { upload } from "@vercel/blob/client";
import { INTRO, THANK_YOU } from "./content";
import { buildSlides, getActiveSections, getQuestionOrdinals, getTotalQuestions } from "./flow";
import type { Slide } from "./flow";
import MicButton from "./MicButton";
import { UnpauseMark } from "./icons";
import type { AnswerPart, FieldSpec, UploadOrTextValue } from "./types";

type AnswerStore = Record<string, unknown>;

type Step =
  | { kind: "intro" }
  | { kind: "resume" }
  | { kind: "slide"; index: number }
  | { kind: "review" }
  | { kind: "done" };

const EASE = [0.16, 1, 0.3, 1] as const;

const UNDERLINE_INPUT =
  "w-full border-b-2 border-neutral-300 bg-transparent px-0.5 pb-2.5 pt-1 text-lg text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 placeholder:italic focus:border-neutral-900";

const EYEBROW_LABEL = "text-xs font-medium tracking-[0.2em] text-neutral-400";

function keyFor(questionId: string, partId: string) {
  return `${questionId}.${partId}`;
}

function stepPosition(step: Step, slideCount: number): number {
  if (step.kind === "resume") return -2;
  if (step.kind === "intro") return -1;
  if (step.kind === "slide") return step.index;
  if (step.kind === "review") return slideCount;
  return slideCount + 1;
}

function isTypingTarget(el: Element | null): boolean {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SECTION_ACCENTS = [
  "#004ac7", // 01 Hello, you.
  "#b5542c", // 02 The people on the other side.
  "#4b6b3c", // 03 Your world, your rules.
  "#7a4b8f", // 04 Let's talk about the logo.
  "#1f6e6e", // 05 What we're working with.
  "#9c6b1f", // 06 Making it real.
  "#a13b5c", // 07 One last thing.
];

function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function reactiveNote(words: number): string | null {
  if (words === 0) return null;
  if (words < 5) return "Good start.";
  if (words < 40) return "Keep going, if there's more.";
  return "This is exactly the kind of detail that helps.";
}

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

function restoreStep(draft: { step: Step; answers: AnswerStore } | null, slideCount: number): Step {
  const s = draft?.step;
  if (!s || typeof s !== "object" || typeof (s as { kind?: unknown }).kind !== "string") {
    return { kind: "intro" };
  }
  if (s.kind === "slide" && typeof (s as { index?: unknown }).index === "number") {
    const maxIndex = Math.max(slideCount - 1, 0);
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
  const shouldReduceMotion = useReducedMotion();
  const note = reactiveNote(wordCount(value ?? ""));
  const hintText = note ?? "Or tap to speak your answer";
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
        {shouldReduceMotion ? (
          <span className="text-xs text-neutral-400">{hintText}</span>
        ) : (
          <AnimatePresence mode="wait">
            <motion.span
              key={hintText}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="text-xs text-neutral-400"
            >
              {hintText}
            </motion.span>
          </AnimatePresence>
        )}
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
      <AnimatePresence mode="popLayout">
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
      <motion.span
        animate={{ scale: selected ? [1, 1.18, 1] : 1 }}
        transition={{ duration: 0.34, ease: EASE }}
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
      </motion.span>
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

export default function UnpauseIntakeForm() {
  const initialDraftRef = useRef<{ step: Step; answers: AnswerStore } | null>(loadDraft());

  const [step, setStep] = useState<Step>(() => {
    const draft = initialDraftRef.current;
    if (draft && Object.keys(draft.answers ?? {}).length > 0) {
      return { kind: "resume" };
    }
    const initialSlideCount = buildSlides(getActiveSections(draft?.answers ?? {})).length;
    return restoreStep(draft, initialSlideCount);
  });
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<AnswerStore>(() => initialDraftRef.current?.answers ?? {});
  const [confirmingReset, setConfirmingReset] = useState(false);
  const activeSections = useMemo(() => getActiveSections(answers), [answers]);
  const slides = useMemo(() => buildSlides(activeSections), [activeSections]);
  const questionOrdinals = useMemo(() => getQuestionOrdinals(slides), [slides]);
  const totalQuestions = useMemo(() => getTotalQuestions(questionOrdinals), [questionOrdinals]);
  const [submitting, setSubmitting] = useState(false);
  const [submitSucceeded, setSubmitSucceeded] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const continueControls = useAnimationControls();

  useEffect(() => {
    if (step.kind === "resume") return;
    if (step.kind === "done") {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
      return;
    }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, answers }));
    } catch {
      // Storage unavailable (private browsing, quota) — the draft just won't persist.
    }
  }, [step, answers]);

  useEffect(() => {
    if (!confirmingReset) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setConfirmingReset(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmingReset]);

  function setAnswer(key: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function resetDraft() {
    setConfirmingReset(false);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    setAnswers({});
    setSubmitSucceeded(false);
    setSubmitError(null);
    transitionTo({ kind: "intro" });
  }

  function resumeDraft() {
    const draft = initialDraftRef.current;
    transitionTo(restoreStep(draft, slides.length));
  }

  const resumeOrdinal = useMemo(() => {
    if (step.kind !== "resume") return 0;
    const restored = restoreStep(initialDraftRef.current, slides.length);
    if (restored.kind === "slide") return questionOrdinals[restored.index] ?? 0;
    if (restored.kind === "review" || restored.kind === "done") return totalQuestions;
    return 0;
  }, [step.kind, slides.length, questionOrdinals, totalQuestions]);

  function transitionTo(next: Step) {
    setDirection(stepPosition(next, slides.length) >= stepPosition(step, slides.length) ? 1 : -1);
    setStep(next);
  }

  function goTo(index: number) {
    if (index < 0) {
      transitionTo({ kind: "intro" });
    } else if (index >= slides.length) {
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
      ? questionOrdinals[step.index]
      : step.kind === "review" || step.kind === "done"
        ? totalQuestions
        : 0;
  const progress = totalQuestions === 0 ? 0 : Math.round((currentOrdinal / totalQuestions) * 100);

  const stepKey = step.kind === "slide" ? `slide-${step.index}` : step.kind;
  const slide = step.kind === "slide" ? (slides[step.index] ?? null) : null;
  const canAdvance = isSlideComplete(slide, answers);
  const lastPart = slide?.kind === "question" ? slide.question.parts[slide.question.parts.length - 1] : null;
  const showEnterHint = lastPart?.part.kind === "short-text";

  const slideVariants = {
    enter: (dir: number) =>
      shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: dir >= 0 ? 64 : -64, scale: 0.97 },
    center: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: shouldReduceMotion
        ? { duration: 0.4, ease: EASE }
        : { duration: 0.55, ease: EASE, staggerChildren: 0.07, delayChildren: 0.1 },
    },
    exit: (dir: number) =>
      shouldReduceMotion
        ? { opacity: 0 }
        : { opacity: 0, x: dir >= 0 ? -64 : 64, scale: 0.97, transition: { duration: 0.3, ease: EASE } },
  };

  const textItemVariants = {
    enter: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 },
    center: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
  };

  const reviewSections = activeSections.map((section) => {
    const items = section.questions.flatMap((question) => {
      const slideIndex = slides.findIndex((s) => s.kind === "question" && s.question.id === question.id);
      return question.parts
        .map((part) => {
          const key = keyFor(question.id, part.id);
          const otherVal = (answers[`${key}__other`] as string) ?? "";
          const display = formatAnswerValue(part.part, answers[key], otherVal);
          if (!display) return null;
          return { label: part.label ?? question.prompt, display, slideIndex };
        })
        .filter((item): item is { label: string; display: string; slideIndex: number } => item !== null);
    });
    return { section, items };
  }).filter((entry) => entry.items.length > 0);

  const liveAnnouncement =
    step.kind === "slide" && slide
      ? slide.kind === "divider"
        ? `Section ${slide.section.number}: ${slide.section.title}`
        : `Question ${questionOrdinals[step.index]} of ${totalQuestions}: ${slide.question.prompt}`
      : step.kind === "review"
        ? "Review your answers before submitting."
        : step.kind === "done"
          ? "Submission complete. Thank you."
          : step.kind === "resume"
            ? "Welcome back. Pick up where you left off, or start over."
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
        <div className="relative pt-6 text-center sm:pt-8">
          <span className="text-sm font-semibold tracking-[0.3em] text-neutral-900">UNPAUSE</span>
          {step.kind !== "intro" && step.kind !== "resume" && (
            <div className="absolute right-6 top-5 sm:right-10 sm:top-7">
              {confirmingReset && (
                <button
                  type="button"
                  aria-hidden="true"
                  tabIndex={-1}
                  className="fixed inset-0 z-20 cursor-default"
                  onClick={() => setConfirmingReset(false)}
                />
              )}
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={confirmingReset}
                onClick={() => setConfirmingReset((v) => !v)}
                className="relative z-30 text-xs font-medium text-neutral-400 transition hover:text-neutral-600"
              >
                Start over
              </button>
              <AnimatePresence>
                {confirmingReset && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                    transition={{ duration: 0.16, ease: EASE }}
                    className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-neutral-900/10 bg-white p-3 text-left shadow-lg"
                  >
                    <p className="text-xs text-neutral-600 leading-relaxed">Clear your answers and start over?</p>
                    <div className="mt-2.5 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmingReset(false)}
                        className="rounded-full px-3 py-1.5 text-xs font-medium text-neutral-500 transition hover:text-neutral-800"
                      >
                        Keep going
                      </button>
                      <button type="button" onClick={resetDraft} className="rounded-full bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800">
                        Start over
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
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
                      <motion.div
                        variants={textItemVariants}
                        className="text-[#004ac7]"
                      >
                        <UnpauseMark />
                      </motion.div>
                      <motion.p
                        variants={textItemVariants}
                        className={EYEBROW_LABEL + " mt-4"}
                      >
                        {INTRO.eyebrow}
                      </motion.p>
                      <motion.h1
                        variants={textItemVariants}
                        className="mt-2 text-3xl font-medium text-neutral-900 sm:text-4xl"
                      >
                        {INTRO.title}
                      </motion.h1>
                      <motion.p variants={textItemVariants} className="mt-4 text-neutral-600 leading-relaxed">
                        {INTRO.body}
                      </motion.p>
                      <motion.p variants={textItemVariants} className="mt-3 text-sm text-neutral-500">
                        {INTRO.time} {INTRO.teamNote}
                      </motion.p>
                    </div>

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

                {step.kind === "resume" && (
                  <div className="flex flex-col gap-6">
                    <div className="max-w-prose">
                      <motion.div variants={textItemVariants} className="text-[#004ac7]">
                        <UnpauseMark />
                      </motion.div>
                      <motion.p variants={textItemVariants} className={EYEBROW_LABEL + " mt-4"}>
                        WELCOME BACK
                      </motion.p>
                      <motion.h1
                        variants={textItemVariants}
                        className="mt-2 text-3xl font-medium text-neutral-900 sm:text-4xl"
                      >
                        Pick up where you left off?
                      </motion.h1>
                      <motion.p variants={textItemVariants} className="mt-4 text-neutral-600 leading-relaxed">
                        {resumeOrdinal > 0
                          ? `You're partway through The Unbrief — question ${resumeOrdinal} of ${totalQuestions}.`
                          : "You started The Unbrief but haven't answered a question yet."}
                      </motion.p>
                    </div>
                    <motion.div variants={textItemVariants} className="flex flex-wrap items-center gap-3">
                      <motion.button
                        type="button"
                        whileHover={{ y: -2, boxShadow: "0 12px 30px rgba(0,0,0,0.14)" }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: "spring", stiffness: 400, damping: 26 }}
                        className="rounded-full bg-[#01213B] px-8 py-3 text-sm font-medium text-white"
                        onClick={resumeDraft}
                      >
                        Continue where I left off
                      </motion.button>
                      <button
                        type="button"
                        onClick={resetDraft}
                        className="rounded-full border border-neutral-300 px-8 py-3 text-sm font-medium text-neutral-600 transition hover:border-neutral-500 hover:text-neutral-900"
                      >
                        Start over
                      </button>
                    </motion.div>
                  </div>
                )}

                {step.kind === "slide" &&
                  slide &&
                  (() => {
                    const accent = SECTION_ACCENTS[slide.sectionIndex % SECTION_ACCENTS.length];
                    return (
                      <div className="flex flex-col gap-8">
                        {slide.kind === "divider" ? (
                          <div className="flex items-start justify-between gap-6">
                            <div className="flex max-w-prose flex-col gap-4">
                              <motion.p
                                variants={textItemVariants}
                                className={EYEBROW_LABEL}
                                style={{ color: accent }}
                              >
                                SECTION <AnimatedOrdinal value={slide.sectionIndex + 1} /> OF {activeSections.length}
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
                            <motion.div
                              aria-hidden="true"
                              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9, x: 16 }}
                              animate={{ opacity: 0.1, scale: 1, x: 0 }}
                              transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
                              className="hidden shrink-0 select-none text-[7rem] font-semibold leading-none sm:block sm:text-[9rem]"
                              style={{ color: accent }}
                            >
                              {String(slide.sectionIndex + 1).padStart(2, "0")}
                            </motion.div>
                          </div>
                        ) : (
                          (() => {
                            const { question } = slide;
                            const mainHeadingId = `heading-${question.id}`;
                            const posInSection = slide.section.questions.findIndex((q) => q.id === question.id);
                            const remainingInSection = slide.section.questions.length - posInSection - 1;
                            return (
                              <div className="flex flex-col gap-8">
                                <div className="max-w-prose">
                                  <motion.p
                                    variants={textItemVariants}
                                    className={EYEBROW_LABEL}
                                  >
                                    {remainingInSection === 0 ? (
                                      "last question in this section"
                                    ) : (
                                      <>
                                        <AnimatedOrdinal value={remainingInSection} />{" "}
                                        {remainingInSection === 1 ? "question" : "questions"} left in this section
                                      </>
                                    )}
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
                  <div className="flex flex-col gap-10">
                    <div className="max-w-prose">
                      <motion.p variants={textItemVariants} className={EYEBROW_LABEL}>
                        BEFORE YOU GO.
                      </motion.p>
                      <motion.h2
                        variants={textItemVariants}
                        className="mt-2 text-2xl font-medium text-neutral-900 sm:text-3xl"
                      >
                        Everything, in one place.
                      </motion.h2>
                      <motion.p variants={textItemVariants} className="mt-3 text-neutral-600 leading-relaxed">
                        {totalQuestions} questions across {reviewSections.length}{" "}
                        {reviewSections.length === 1 ? "section" : "sections"} — here's what you told us. Tap
                        anything below to change it.
                      </motion.p>
                    </div>

                    <motion.div variants={textItemVariants} className="flex flex-col gap-9">
                      {reviewSections.map(({ section, items }) => {
                        const trueIndex = activeSections.findIndex((s) => s.id === section.id);
                        const accent = SECTION_ACCENTS[trueIndex % SECTION_ACCENTS.length];
                        return (
                          <div key={section.id} className="flex flex-col gap-3">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs font-semibold tabular-nums" style={{ color: accent }}>
                                {String(trueIndex + 1).padStart(2, "0")}
                              </span>
                              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                                {section.title}
                              </h3>
                            </div>
                            <dl className="flex flex-col">
                              {items.map((item, j) => (
                                <motion.div
                                  key={j}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => goTo(item.slideIndex)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      goTo(item.slideIndex);
                                    }
                                  }}
                                  whileHover={{ x: 3 }}
                                  whileTap={{ scale: 0.99 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 32 }}
                                  className="group -mx-3 flex cursor-pointer items-start justify-between gap-4 border-b border-neutral-900/[0.06] px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-neutral-900/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                                >
                                  <div className="flex flex-col gap-1">
                                    <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-neutral-400">
                                      {item.label}
                                    </dt>
                                    <dd className="text-[15px] font-medium leading-snug text-neutral-800">
                                      {item.display}
                                    </dd>
                                  </div>
                                  <svg
                                    aria-hidden="true"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="mt-1 shrink-0 text-neutral-300 opacity-60 transition-all group-hover:translate-x-0.5 group-hover:text-neutral-900 group-hover:opacity-100 group-focus-visible:opacity-100"
                                  >
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                                  </svg>
                                </motion.div>
                              ))}
                            </dl>
                          </div>
                        );
                      })}
                    </motion.div>

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
              onClick={() => (step.kind === "slide" ? goTo(step.index - 1) : goTo(slides.length - 1))}
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
                    : step.index === slides.length - 1
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
