import { requireAdmin } from "@/lib/auth";

/** Espace Commercial (CRM) : séparé du reste de l'admin, réservé à l'équipe. */
export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <div className="min-h-dvh bg-black text-text-strong">{children}</div>;
}
