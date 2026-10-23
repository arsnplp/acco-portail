"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/** Fenêtre : volet par le bas sur téléphone, centrée sur ordinateur. Échap ou clic à côté pour fermer. */
export function Dialog({ title, onClose, header, size = "md", children }: { title: React.ReactNode; onClose: () => void; header?: React.ReactNode; size?: "md" | "lg"; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-6" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal className={`flex max-h-[90vh] w-full flex-col ${size === "lg" ? "max-w-4xl" : "max-w-2xl"} rounded-t-2xl border border-border bg-bg sm:rounded-2xl`}>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <h2 className="min-w-0 truncate text-base">{title}</h2>
          <div className="ml-auto flex items-center gap-2">{header}<button type="button" onClick={onClose} aria-label="Fermer" className="flex size-9 items-center justify-center rounded-full border border-border text-text hover:text-title"><X size={16} /></button></div>
        </div>
        <div className="overflow-y-auto p-4" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>{children}</div>
      </div>
    </div>
  );
}
