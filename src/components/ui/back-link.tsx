"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/** Revient à la page précédente quand on vient de l'app, sinon va vers `fallback`. */
export function BackLink({ fallback, label, className = "" }: { fallback: string; label: string; className?: string }) {
  const router = useRouter();
  return (
    <a
      href={fallback}
      onClick={(e) => {
        e.preventDefault();
        const cameFromApp = typeof document !== "undefined" && document.referrer.startsWith(window.location.origin) && window.history.length > 1;
        if (cameFromApp) router.back(); else router.push(fallback);
      }}
      className={`inline-flex items-center gap-1 text-sm text-text hover:text-title ${className}`}
    >
      <ChevronLeft size={16} /> {label}
    </a>
  );
}
