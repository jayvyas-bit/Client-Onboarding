import { useCallback, useEffect, useRef, useState } from "react";

interface DeepgramResultMessage {
  type: "Results";
  is_final: boolean;
  channel: { alternatives: Array<{ transcript: string }> };
}

function isResultMessage(msg: unknown): msg is DeepgramResultMessage {
  return typeof msg === "object" && msg !== null && (msg as { type?: unknown }).type === "Results";
}

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["audio/webm;codecs=opus", "audio/webm"];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

function describeError(reason: "mic" | "token" | "socket"): string {
  switch (reason) {
    case "mic":
      return "Microphone access is blocked. Allow it in your browser's site settings and try again.";
    case "token":
      return "Voice input couldn't start right now. Please try again.";
    case "socket":
    default:
      return "Voice input hit a snag. Please try again or type your answer.";
  }
}

const mimeType = pickMimeType();
const isSupported =
  typeof window !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof WebSocket !== "undefined" &&
  mimeType !== null;

export function useVoiceInput(value: string, onChange: (next: string) => void) {
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const baseRef = useRef("");
  const finalRef = useRef("");
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const teardown = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setListening(false);
  }, []);

  const applyTranscript = useCallback((transcript: string, isFinal: boolean) => {
    if (isFinal) {
      finalRef.current = finalRef.current ? `${finalRef.current} ${transcript}` : transcript;
      onChangeRef.current(baseRef.current ? `${baseRef.current} ${finalRef.current}` : finalRef.current);
    } else {
      const spoken = [finalRef.current, transcript].filter(Boolean).join(" ");
      onChangeRef.current(baseRef.current ? `${baseRef.current} ${spoken}` : spoken);
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    baseRef.current = valueRef.current ?? "";
    finalRef.current = "";

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(describeError("mic"));
      return;
    }

    let accessToken: string;
    try {
      const tokenRes = await fetch("/api/unpause/deepgram-token");
      const body = (await tokenRes.json()) as { ok: boolean; accessToken?: string };
      if (!tokenRes.ok || !body.ok || !body.accessToken) throw new Error("token");
      accessToken = body.accessToken;
    } catch {
      setError(describeError("token"));
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const params = new URLSearchParams({
      model: "nova-2",
      smart_format: "true",
      punctuate: "true",
      interim_results: "true",
      endpointing: "300",
    });
    const socket = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ["bearer", accessToken]);
    socketRef.current = socket;
    streamRef.current = stream;

    socket.onopen = () => {
      const recorder = new MediaRecorder(stream, { mimeType: mimeType! });
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
          socket.send(event.data);
        }
      };
      recorder.start(250);
      setListening(true);
    };

    socket.onmessage = (event) => {
      try {
        const msg: unknown = JSON.parse(event.data as string);
        if (!isResultMessage(msg)) return;
        const transcript = msg.channel.alternatives[0]?.transcript.trim() ?? "";
        if (!transcript) return;
        applyTranscript(transcript, msg.is_final);
      } catch {
        // ignore malformed message
      }
    };

    socket.onerror = () => {
      setError(describeError("socket"));
      teardown();
    };

    socket.onclose = () => setListening(false);
  }, [applyTranscript, teardown]);

  useEffect(() => () => teardown(), [teardown]);

  return {
    supported: isSupported,
    listening,
    error,
    toggle: () => (listening ? teardown() : start()),
  };
}
