"use client";

import { useEffect, useRef } from "react";
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
  const activeRef = useRef<HTMLAnchorElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // L'onglet actif se cale dans la zone visible.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [pathname]);

  // Souris : la molette fait défiler la barre horizontalement.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <nav className="sticky top-14 z-20 border-b border-border bg-bg/95 backdrop-blur">
      <ul ref={listRef} className="mx-auto flex max-w-3xl gap-1 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden">
        {ITEMS.map(([href, label]) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                ref={active ? activeRef : undefined}
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
