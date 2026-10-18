import type { LucideIcon } from "lucide-react";

export function Empty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-border p-8 text-center">
      <Icon className="mx-auto text-text" size={28} strokeWidth={1.5} />
      <p className="mt-3 font-semibold text-title">{title}</p>
      {text && <p className="mt-1 text-sm text-text">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
