"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Sparkles, HeartHandshake, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number; aussi?: string[] };

export const CLIENT_NAV: NavItem[] = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/services", label: "Mes services", icon: LayoutGrid, aussi: ["/sites"] },
  { href: "/studio", label: "Studio", icon: Sparkles },
  { href: "/accompagnement", label: "Accompagnement", icon: HeartHandshake, aussi: ["/messages", "/historique", "/conseils", "/difficultes"] },
];

export function BottomNav({ items, badges = {} }: { items: NavItem[]; badges?: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigation principale"
    >
      <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`, height: "var(--nav-h)" }}>
        {items.map((item) => { const { href, label, icon: Icon } = item;
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href) || (item.aussi ?? []).some((a) => pathname.startsWith(a));
          const badge = badges[href];
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn("relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-title" : "text-text")}
              >
                <Icon size={22} strokeWidth={active ? 2 : 1.6} />
                {label}
                {badge ? (
                  <span className="absolute top-2 right-1/2 translate-x-4 min-w-4 h-4 px-1 rounded-full bg-pink text-bg text-[10px] font-bold flex items-center justify-center">
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
