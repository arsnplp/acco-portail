"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  ["activite", "Activité"],
  ["resultats", "Résultats"],
  ["avis", "Avis"],
  ["modifications", "Modifications"],
  ["conseils", "Conseils"],
] as const;

export function SiteTabs({ siteId, enabled }: { siteId: string; enabled: boolean }) {
  const pathname = usePathname();
  return (
    <div className="mt-5 border-b border-border">
      <ul className="flex gap-1 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map(([slug, label]) => {
          const href = `/sites/${siteId}/${slug}`;
          const active = pathname.startsWith(href);
          if (!enabled) {
            return (
              <li key={slug} className="shrink-0">
                <span className="block px-3 py-3 text-sm text-muted cursor-not-allowed" title="Disponible à la mise en ligne">
                  {label}
                </span>
              </li>
            );
          }
          return (
            <li key={slug} className="shrink-0">
              <Link
                href={href}
                className={cn("block px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors", active ? "border-title text-title" : "border-transparent text-text hover:text-title")}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      {!enabled && <p className="px-4 pb-3 pt-1 text-xs text-muted">Ces onglets seront disponibles à la mise en ligne.</p>}
    </div>
  );
}
