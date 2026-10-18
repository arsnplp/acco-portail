"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  ["/admin", "Tableau de bord"],
  ["/admin/clients", "Clients"],
  ["/admin/sites", "Sites"],
  ["/admin/modifications", "Modifications"],
  ["/admin/offres", "Offres"],
  ["/admin/commandes", "Commandes"],
  ["/admin/messages", "Messages"],
  ["/admin/recommandations", "Recommandations"],
  ["/admin/documents", "Documents"],
  ["/admin/parametres", "Paramètres"],
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-14 z-20 border-b border-border bg-bg/95 backdrop-blur">
      <ul className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ITEMS.map(([href, label]) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link href={href} className={cn("block rounded-full px-3 py-1.5 text-sm font-medium transition-colors", active ? "bg-title text-bg" : "text-text hover:text-title")}>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
