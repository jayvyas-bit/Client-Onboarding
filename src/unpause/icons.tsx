const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export type SectionIconId =
  | "hello-you"
  | "the-people"
  | "your-world"
  | "the-logo"
  | "working-with"
  | "making-it-real"
  | "one-last-thing";

const PATHS: Record<SectionIconId, React.ReactNode> = {
  "hello-you": (
    <>
      <path d="M4 15c1.5-6 3.5-9 6-9s2.5 5 .5 7.5-1.5 3.5 1 3.5 5-2.5 7-6.5" />
      <circle cx="19.3" cy="7" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  "the-people": (
    <>
      <circle cx="9" cy="12" r="6" />
      <circle cx="15" cy="12" r="6" />
    </>
  ),
  "your-world": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.2 8.8 13 13l-4.2 2.2L11 11z" />
    </>
  ),
  "the-logo": (
    <>
      <circle cx="9.5" cy="14.5" r="4.5" />
      <path d="M15 6.5 19.5 15h-9z" />
    </>
  ),
  "working-with": (
    <>
      <rect x="5" y="6.5" width="11" height="8.5" rx="1" transform="rotate(-7 10.5 10.75)" />
      <rect x="7.5" y="9" width="11" height="8.5" rx="1" transform="rotate(5 13 13.25)" />
    </>
  ),
  "making-it-real": (
    <path d="M7.5 4h9M7.5 20h9M7.5 4c0 4 4.5 6 4.5 8s-4.5 4-4.5 8M16.5 4c0 4-4.5 6-4.5 8s4.5 4 4.5 8" />
  ),
  "one-last-thing": (
    <>
      <path d="M3 11.2 20.5 4 14 21l-2.7-7.6z" />
      <path d="M11.3 13.4 19.5 5.2" />
    </>
  ),
};

export function SectionIcon({
  id,
  size = 22,
  className,
  style,
}: {
  id: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const content = PATHS[id as SectionIconId];
  if (!content) return null;
  return (
    <svg {...ICON_PROPS} width={size} height={size} className={className} style={style} aria-hidden="true">
      {content}
    </svg>
  );
}

export function UnpauseMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 48 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="48"
      height="32"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M8 6v20" />
      <path d="M18 6v20" />
      <path d="M30 6 42 16 30 26Z" />
    </svg>
  );
}
