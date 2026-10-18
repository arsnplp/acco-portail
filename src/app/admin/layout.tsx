import { requireAdmin, initials } from "@/lib/auth";
import { Header } from "@/components/nav/header";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <>
      <Header initials={initials(user)} avatarUrl={user.avatarUrl} accountHref="/admin/parametres" right={<span className="text-xs text-text mr-1">Équipe</span>} />
      <AdminNav />
      {children}
    </>
  );
}
