import { PhoneMissedIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { nrpTone } from "@/lib/crm";

const COLORS = { none: "bg-surface-2", yellow: "bg-yellow", orange: "bg-claude", red: "bg-pink" } as const;
const TEXT = { none: "text-muted", yellow: "text-yellow", orange: "text-claude", red: "text-pink" } as const;

/** Nombre d'appels sans réponse : 5 crans qui se remplissent et changent de couleur (jaune, orange, rouge). */
export function NrpMeter({ n, className }: { n: number; className?: string }) {
  const tone = nrpTone(n);
  return (
    <span title={`${n} appel${n > 1 ? "s" : ""} sans réponse`} className={cn("inline-flex shrink-0 items-center gap-1", TEXT[tone], className)}>
      <PhoneMissedIcon size={12} aria-hidden />
      <span className="flex gap-[2px]" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => <span key={i} className={cn("h-2 w-1.5 rounded-[2px]", i <= n ? COLORS[tone] : "bg-surface-2")} />)}
      </span>
      <span className="text-[10px] font-semibold tabular-nums">{n > 5 ? "5+" : n}</span>
      <span className="sr-only">appels sans réponse</span>
    </span>
  );
}
