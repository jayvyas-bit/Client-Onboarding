import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { upload } from "@vercel/blob/client";
import { INTRO, SECTIONS, THANK_YOU } from "./content";
import { QUESTION_ORDINALS, SLIDES, TOTAL_QUESTIONS } from "./flow";
import MicButton from "./MicButton";
import type { AnswerPart, FieldSpec, UploadOrTextValue } from "./types";

type AnswerStore = Record<string, unknown>;

type Step = { kind: "intro" } | { kind: "slide"; index: number } | { kind: "review" } | { kind: "done" };

const EASE = [0.16, 1, 0.3, 1] as const;

const UNDERLINE_INPUT =
  "w-full border-b-2 border-neutral-300 bg-transparent px-0.5 pb-2.5 pt-1 text-lg text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 placeholder:italic focus:border-neutral-900";

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
      {fields.map((field) => (
        <label key={field.id} className="flex flex-col gap-1.5 text-sm">
          <span className="text-neutral-500">{field.label}</span>
          <input
            type="text"
            className={UNDERLINE_INPUT + " text-base"}
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
  onAdvance,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  onAdvance?: () => void;
}) {
  return (
    <div className="flex items-end gap-3">
      <input
        type="text"
        className={UNDERLINE_INPUT}
        placeholder={placeholder}
        value={value ?? ""}
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
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <textarea
        rows={4}
        className={UNDERLINE_INPUT + " resize-none"}
        placeholder={placeholder ?? "Type your answer..."}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex items-center gap-2.5">
        <MicButton onTranscript={(text) => onChange(value ? `${value} ${text}` : text)} />
        <span className="text-xs text-neutral-400">Or tap to speak your answer</span>
      </div>
    </div>
  );
}

function OptionRow({
  index,
  label,
  selected,
  shape,
  disabled,
  onSelect,
}: {
  index: number;
  label: string;
  selected: boolean;
  shape: "circle" | "square";
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
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
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
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
              <polyline points="20 6 9 17 4 12" />
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
}: {
  options: string[];
  allowOther?: boolean;
  value: string;
  otherValue: string;
  onChange: (next: string) => void;
  onOtherChange: (next: string) => void;
  onAdvance?: () => void;
}) {
  const effectiveOptions = allowOther ? [...options, "Something else"] : options;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(document.activeElement)) return;
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < effectiveOptions.length) handleSelect(effectiveOptions[idx]);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOptions.join("|")]);

  return (
    <div className="flex flex-col gap-2.5">
      {effectiveOptions.map((option, index) => (
        <OptionRow
          key={option}
          index={index}
          label={option}
          shape="circle"
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
}: {
  options: string[];
  allowOther?: boolean;
  maxSelect?: number;
  value: string[];
  otherValue: string;
  onChange: (next: string[]) => void;
  onOtherChange: (next: string) => void;
  onAdvance?: () => void;
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(document.activeElement)) return;
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < effectiveOptions.length) toggle(effectiveOptions[idx]);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOptions.join("|"), selected.join("|"), atLimit]);

  return (
    <div className="flex flex-col gap-2.5">
      {maxSelect && (
        <p className="text-xs text-neutral-500">
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
}: {
  value: UploadOrTextValue;
  onChange: (next: UploadOrTextValue) => void;
  placeholder?: string;
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
      {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
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
}: {
  part: AnswerPart;
  value: unknown;
  otherValue: string;
  onChange: (next: unknown) => void;
  onOtherChange: (next: string) => void;
  onAdvance?: () => void;
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
        />
      );
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
          onAdvance={onAdvance}
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
  const [step, setStep] = useState<Step>({ kind: "intro" });
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<AnswerStore>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

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
      transitionTo({ kind: "done" });
    } catch {
      setSubmitError("Something went wrong sending your answers. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (step.kind !== "slide") return;
    const el = slideRef.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      "input[type=text], textarea",
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
  const showEnterHint = slide?.kind === "question" && slide.part.part.kind === "short-text";

  const slideVariants = {
    enter: (dir: number) =>
      shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: dir >= 0 ? 32 : -32 },
    center: { opacity: 1, x: 0 },
    exit: (dir: number) =>
      shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: dir >= 0 ? -32 : 32 },
  };

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
            className="h-full bg-neutral-900"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 220, damping: 30 }}
          />
        </div>
      )}

      <div className="relative z-10 flex min-h-dvh flex-col">
        <div className="flex flex-1 items-center justify-center px-6 py-20 sm:px-10">
          <div className="w-full max-w-2xl">
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
                    <p className="text-xs font-medium tracking-[0.2em] text-neutral-400">{INTRO.eyebrow}</p>
                    <h1 className="text-3xl font-medium text-neutral-900 sm:text-4xl">{INTRO.title}</h1>
                    {INTRO.body.map((p) => (
                      <p key={p} className="text-neutral-600 leading-relaxed">
                        {p}
                      </p>
                    ))}
                    <p className="text-sm text-neutral-500">{INTRO.time}</p>

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
                          whileHover={{ y: -3 }}
                          transition={{ type: "spring", stiffness: 300, damping: 24 }}
                          className="rounded-xl border border-neutral-200 bg-white/70 p-4 shadow-sm"
                        >
                          <p className="font-medium text-neutral-900">{member.name}</p>
                          <p className="text-xs text-neutral-500">{member.role}</p>
                          <p className="mt-2 text-sm text-neutral-600">{member.line}</p>
                        </motion.div>
                      ))}
                    </motion.div>
                    <p className="text-sm italic text-neutral-500">{INTRO.teamNote}</p>

                    <motion.button
                      type="button"
                      whileHover={{ y: -2, boxShadow: "0 10px 25px -10px rgba(0,0,0,0.35)" }}
                      whileTap={{ scale: 0.97 }}
                      transition={{ type: "spring", stiffness: 400, damping: 26 }}
                      className="mt-4 w-fit rounded-full bg-neutral-900 px-8 py-3 text-sm font-medium text-white"
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
                          <div className="flex flex-col gap-4">
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: 28 }}
                              transition={{ duration: 0.4, ease: EASE }}
                              className="w-0.5 rounded-full bg-neutral-900/30"
                            />
                            <p className="text-xs font-medium tracking-[0.2em] text-neutral-400">
                              SECTION {slide.section.number} / {String(SECTIONS.length).padStart(2, "0")}
                            </p>
                            <h2 className="text-3xl font-medium text-neutral-900 sm:text-4xl">
                              {slide.section.title}
                            </h2>
                            <p className="text-sm text-neutral-500">{slide.section.host}</p>
                            {slide.section.intro && (
                              <p className="text-neutral-600 leading-relaxed">{slide.section.intro}</p>
                            )}
                          </div>
                        ) : (
                          (() => {
                            const { question, part, partCount } = slide;
                            const isMainPart = part.id === "main" || !part.label;
                            const heading = isMainPart ? question.prompt : part.label!;
                            const helper = isMainPart ? question.helper : part.helper;
                            const key = keyFor(question.id, part.id);
                            const otherKey = `${key}__other`;
                            return (
                              <div className="flex flex-col gap-6">
                                <div>
                                  <p className="text-xs font-medium tracking-[0.2em] text-neutral-400">
                                    QUESTION {ordinal} OF {TOTAL_QUESTIONS}
                                  </p>
                                  {!isMainPart && partCount > 1 && (
                                    <p className="mt-2 text-sm italic text-neutral-400">
                                      Following up: &ldquo;{question.prompt}&rdquo;
                                    </p>
                                  )}
                                  <h2 className="mt-2 text-2xl font-medium text-neutral-900 sm:text-3xl">
                                    {heading}
                                  </h2>
                                  {helper && <p className="mt-2 text-neutral-500 leading-relaxed">{helper}</p>}
                                </div>
                                <PartRenderer
                                  part={part.part}
                                  value={answers[key]}
                                  otherValue={(answers[otherKey] as string) ?? ""}
                                  onChange={(v) => setAnswer(key, v)}
                                  onOtherChange={(v) => setAnswer(otherKey, v)}
                                  onAdvance={() => goTo(step.index + 1)}
                                />
                              </div>
                            );
                          })()
                        )}
                      </div>
                    );
                  })()}

                {step.kind === "review" && (
                  <div className="flex flex-col gap-6">
                    <p className="text-xs font-medium tracking-[0.2em] text-neutral-400">BEFORE YOU GO.</p>
                    <h2 className="text-2xl font-medium text-neutral-900 sm:text-3xl">One last look.</h2>
                    <p className="text-neutral-600 leading-relaxed">
                      Here's a summary of what you've shared with us:
                    </p>
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
                  </div>
                )}

                {step.kind === "done" && (
                  <div className="flex flex-col gap-5 py-10 text-center">
                    <motion.svg
                      width="64"
                      height="64"
                      viewBox="0 0 64 64"
                      className="mx-auto text-neutral-900"
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
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {(step.kind === "slide" || step.kind === "review") && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-900/5 bg-[#faf8f5]/85 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4 sm:px-10">
            <button
              type="button"
              className="text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
              onClick={() => (step.kind === "slide" ? goTo(step.index - 1) : goTo(SLIDES.length - 1))}
            >
              ← Back
            </button>
            <div className="flex items-center gap-3">
              {showEnterHint && (
                <span className="hidden text-xs text-neutral-400 sm:inline">press Enter ↵</span>
              )}
              <motion.button
                type="button"
                disabled={step.kind === "review" && submitting}
                whileHover={{ y: -2, boxShadow: "0 10px 25px -10px rgba(0,0,0,0.35)" }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 26 }}
                className="rounded-full bg-neutral-900 px-8 py-3 text-sm font-medium text-white disabled:opacity-50"
                onClick={() => (step.kind === "review" ? handleSubmit() : goTo(step.index + 1))}
              >
                {step.kind === "review"
                  ? submitting
                    ? "Submitting..."
                    : "Submit The Unbrief"
                  : step.index === SLIDES.length - 1
                    ? "Review your answers"
                    : "Continue"}
              </motion.button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
