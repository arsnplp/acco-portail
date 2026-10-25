"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronDownIcon, UsersIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Menu déroulant qui change de vue (chaque choix = une adresse), à la place d'une rangée de puces. */
export function UrlSelect({ value, options, label, className }: { value: string; options: { value: string; label: string; href: string }[]; label: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <UsersIcon size={15} className="pointer-events-none absolute left-3.5 text-text" aria-hidden />
      <select
        value={value}
        aria-label={label}
        disabled={pending}
        onChange={(e) => { const o = options.find((x) => x.value === e.target.value); if (o) start(() => router.push(o.href)); }}
        className="h-10 w-full appearance-none rounded-full border border-border bg-surface pr-9 pl-9 text-sm font-semibold text-title outline-none hover:border-text disabled:opacity-60"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDownIcon size={15} className="pointer-events-none absolute right-3.5 text-text" aria-hidden />
    </label>
  );
}
