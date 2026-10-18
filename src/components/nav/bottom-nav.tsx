"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Globe, Tag, MessageCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number };

export const CLIENT_NAV: NavItem[] = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/sites", label: "Mes sites", icon: Globe },
  { href: "/offres", label: "Offres", icon: Tag },
  { href: "/messages", label: "Messages", icon: MessageCircle },
];

export function BottomNav({ items, badges = {} }: { items: NavItem[]; badges?: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navigation principale"
    >
      <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)`, height: "var(--nav-h)" }}>
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
