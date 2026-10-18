import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function AdminPage({ title, back, action, children }: { title: React.ReactNode; back?: { href: string; label: string }; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1 text-sm text-text hover:text-title">
          <ChevronLeft size={16} /> {back.label}
        </Link>
      )}
      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="text-2xl">{title}</h1>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </main>
  );
}
