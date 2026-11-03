"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type Tab = { slug: string; label: string };

/** Onglets du site : seulement ce qui est inclus ou éligible (14.1), jamais de menus verrouillés. */
export function SiteTabs({ siteId, tabs }: { siteId: string; tabs: Tab[] }) {
  const pathname = usePathname();
  return (
    <div className="mt-5 border-b border-border">
      <ul className="flex gap-1 overflow-x-auto overscroll-x-contain px-3 [scrollbar-width:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden">
        {tabs.map(({ slug, label }) => {
          const href = slug ? `/sites/${siteId}/${slug}` : `/sites/${siteId}`;
          const active = slug ? pathname.startsWith(href) : pathname === href;
          return (
            <li key={slug} className="shrink-0">
              <Link href={href} className={cn("-mb-px block border-b-2 px-3 py-3 text-sm font-medium transition-colors", active ? "border-title text-title" : "border-transparent text-text hover:text-title")}>{label}</Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
