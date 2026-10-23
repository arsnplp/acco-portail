import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export function Card({ className, children, href, id }: { className?: string; children: React.ReactNode; href?: string; id?: string }) {
  const cls = cn("block rounded-card border border-border bg-surface p-4", href && "hover:border-text transition-colors", className);
  if (href) return <Link href={href} id={id} className={cls}>{children}</Link>;
  return <div id={id} className={cls}>{children}</div>;
}

export function SectionTitle({ icon: Icon, children, action }: { icon?: LucideIcon; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-3 mt-8 first:mt-0">
      <h2 className="text-lg flex items-center gap-2">
        {Icon && <Icon size={18} strokeWidth={1.75} className="shrink-0 text-text" aria-hidden />}
        {children}
      </h2>
      {action}
    </div>
  );
}
