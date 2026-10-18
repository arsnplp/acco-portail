/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/cn";

export function Avatar({ initials, src, size = 36, className }: { initials: string; src?: string | null; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-full border border-border bg-surface-2 text-xs font-semibold text-title overflow-hidden", className)}
      style={{ width: size, height: size }}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initials}
    </span>
  );
}
