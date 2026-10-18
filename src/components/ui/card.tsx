import Link from "next/link";
import { cn } from "@/lib/cn";

export function Card({ className, children, href }: { className?: string; children: React.ReactNode; href?: string }) {
  const cls = cn("block rounded-card border border-border bg-surface p-4", href && "hover:border-text transition-colors", className);
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <div className={cls}>{children}</div>;
}

export function SectionTitle({ emoji, children, action }: { emoji?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-3 mt-8 first:mt-0">
      <h2 className="text-lg flex items-center gap-2">
        {emoji && <span aria-hidden>{emoji}</span>}
        {children}
      </h2>
      {action}
    </div>
  );
}
