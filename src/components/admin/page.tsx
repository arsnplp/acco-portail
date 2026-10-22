import { BackLink } from "@/components/ui/back-link";

export function AdminPage({ title, back, action, children }: { title: React.ReactNode; back?: { href: string; label: string }; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      {back && (
        <BackLink fallback={back.href} label={back.label} />
      )}
      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-2xl">{title}</h1>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="mt-6">{children}</div>
    </main>
  );
}
