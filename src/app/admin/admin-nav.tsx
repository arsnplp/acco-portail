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
      <ul className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ITEMS.map(([href, label]) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                className={cn(
                  "-mb-px block border-b-2 px-2.5 py-3 text-sm transition-colors",
                  active ? "border-title font-semibold text-title" : "border-transparent text-text hover:text-title",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
