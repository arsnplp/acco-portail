import { cn } from "@/lib/cn";

export type Tone = "green" | "yellow" | "pink" | "blue" | "claude" | "violet" | "neutral";

const tones: Record<Tone, string> = {
  green: "text-green",
  yellow: "text-yellow",
  pink: "text-pink",
  blue: "text-blue",
  claude: "text-claude",
  violet: "text-violet",
  neutral: "text-text",
};
const dots: Record<Tone, string> = {
  green: "bg-green",
  yellow: "bg-yellow",
  pink: "bg-pink",
  blue: "bg-blue",
  claude: "bg-claude",
  violet: "bg-violet",
  neutral: "bg-text",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium", tones[tone], className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", dots[tone])} />
      <span className="truncate">{children}</span>
    </span>
  );
}

export function Dot({ tone = "pink", className }: { tone?: Tone; className?: string }) {
  return <span className={cn("inline-block size-2 rounded-full", dots[tone], className)} />;
}
