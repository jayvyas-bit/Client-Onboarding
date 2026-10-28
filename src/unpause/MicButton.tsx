import { motion } from "motion/react";
import { useVoiceInput } from "./useVoiceInput";

export default function MicButton({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { supported, listening, error, toggle } = useVoiceInput(value, onChange);

  if (!supported) return null;

  return (
    <div className="relative inline-flex shrink-0">
      <motion.button
        type="button"
        onClick={toggle}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        aria-label={listening ? "Stop recording" : "Speak your answer"}
        title={listening ? "Stop recording" : "Speak your answer"}
        className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors ${
          listening
            ? "border-neutral-900 bg-neutral-900 text-white"
            : "border-neutral-300 bg-white text-neutral-500 hover:border-neutral-500 hover:text-neutral-900"
        }`}
      >
        {listening && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full border border-neutral-900"
              animate={{ scale: [1, 1.9], opacity: [0.5, 0] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.span
              className="absolute inset-0 rounded-full border border-neutral-900"
              animate={{ scale: [1, 1.9], opacity: [0.5, 0] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: "easeOut", delay: 0.65 }}
            />
          </>
        )}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="relative"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </motion.button>
      {error && (
        <span
          role="alert"
          className="absolute left-0 top-full z-10 mt-1.5 w-48 text-xs leading-snug text-red-600"
        >
          {error}
        </span>
      )}
    </div>
  );
}
