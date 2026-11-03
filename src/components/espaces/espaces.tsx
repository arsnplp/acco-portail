import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

export type Espace = {
  href: string; name: string; text: string; image?: string;
  /** Teinte de la pastille et du survol. */
  accent: string;
  stat?: { value: number; label: string };
};

/** Les grands espaces de l'équipe : un choix sobre, sans illustration. */
export function Espaces({ items }: { items: Espace[] }) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${items.length >= 3 ? "lg:grid-cols-3" : ""}`}>
      {items.map((e) => (
        <Link key={e.href} href={e.href} className="group flex items-center justify-between gap-4 rounded-card border border-border bg-surface px-5 py-5 transition-colors hover:border-text">
          <div className="min-w-0">
            <p className="font-title text-xl font-extrabold text-title">{e.name}</p>
            <p className="mt-0.5 text-sm text-text">{e.text}</p>
            {e.stat && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-text-strong">
                <span className="size-2 rounded-full" style={{ background: e.stat.value > 0 ? e.accent : "#7a7d85" }} />
                {e.stat.value > 0 ? `${e.stat.value} ${e.stat.label}` : "Tout est à jour"}
              </p>
            )}
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-text transition-colors group-hover:border-transparent group-hover:bg-[var(--a)] group-hover:text-white" style={{ ["--a" as string]: e.accent }}>
            <ArrowRightIcon size={17} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>
      ))}
    </div>
  );
}
