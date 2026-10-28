import { useVoiceInput } from "./useVoiceInput";

export default function MicButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const { supported, listening, toggle } = useVoiceInput(onTranscript);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? "Stop recording" : "Speak your answer"}
      title={listening ? "Stop recording" : "Speak your answer"}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
        listening
          ? "unpause-pulse border-red-400 bg-red-50 text-red-600"
          : "border-neutral-300 bg-white text-neutral-500 hover:border-neutral-500 hover:text-neutral-800"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </button>
  );
}
