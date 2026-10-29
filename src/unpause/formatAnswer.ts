interface StoredUploadFile {
  name: string;
  size: number;
  path: string;
}

export interface AnswerSegment {
  text: string;
  href?: string;
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]/g;

function linkifySegments(text: string): AnswerSegment[] {
  if (!text) return [];
  const segments: AnswerSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) segments.push({ text: text.slice(lastIndex, start) });
    segments.push({ text: match[0], href: match[0] });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex) });
  return segments.length ? segments : [{ text }];
}

export function formatValueSegments(value: unknown): AnswerSegment[] {
  if (value === undefined || value === null || value === "") return [{ text: "—" }];
  if (Array.isArray(value)) {
    if (!value.length) return [{ text: "—" }];
    const segments: AnswerSegment[] = [];
    value.forEach((item, i) => {
      if (i > 0) segments.push({ text: ", " });
      segments.push(...linkifySegments(String(item)));
    });
    return segments;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("files" in obj || "text" in obj) {
      const text = (obj.text as string) ?? "";
      const files = (obj.files as StoredUploadFile[]) ?? [];
      const segments: AnswerSegment[] = [];
      if (text.trim()) segments.push(...linkifySegments(text));
      if (files.length) {
        if (segments.length) segments.push({ text: " — " });
        segments.push({ text: "Files: " });
        files.forEach((f, i) => {
          if (i > 0) segments.push({ text: ", " });
          segments.push({ text: f.name, href: f.path });
        });
      }
      return segments.length ? segments : [{ text: "—" }];
    }
    const entries = Object.entries(obj).filter(([, v]) => v !== "" && v !== undefined);
    if (entries.length === 0) return [{ text: "—" }];
    const segments: AnswerSegment[] = [];
    entries.forEach(([k, v], i) => {
      if (i > 0) segments.push({ text: " · " });
      segments.push({ text: `${k}: ` });
      segments.push(...linkifySegments(String(v)));
    });
    return segments;
  }
  return linkifySegments(String(value));
}

export function formatValue(value: unknown): string {
  return formatValueSegments(value)
    .map((s) => s.text)
    .join("");
}
