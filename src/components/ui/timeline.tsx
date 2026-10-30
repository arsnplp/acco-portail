import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Tone } from "@/components/ui/badge";
import { CheckIcon } from "lucide-react";

export type TimelineItem = { id: string; date: Date; title: string; description?: string | null; items?: string[]; tone?: Tone };

const dot: Record<Tone, string> = { green: "bg-green", yellow: "bg-yellow", pink: "bg-pink", blue: "bg-blue", claude: "bg-claude", violet: "bg-violet", neutral: "bg-text" };

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative ml-2 border-l border-border">
      {items.map((it) => (
        <li key={it.id} className="relative pl-6 pb-7 last:pb-0">
          <span className={cn("absolute -left-[5px] top-1.5 size-2.5 rounded-full ring-4 ring-bg", dot[it.tone ?? "blue"])} />
          <p className="text-xs text-muted">{fmtDate(it.date)}</p>
          <p className="mt-0.5 font-semibold text-title">{it.title}</p>
          {it.description && <p className="mt-1 text-sm text-text">{it.description}</p>}
          {it.items && it.items.length > 0 && (
            <ul className="mt-2 space-y-1">
              {it.items.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-text-strong">
                  <CheckIcon size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-green" aria-hidden />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
