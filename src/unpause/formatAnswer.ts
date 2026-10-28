interface StoredUploadFile {
  name: string;
  size: number;
  path: string;
}

export function formatValue(value: unknown): string {
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
