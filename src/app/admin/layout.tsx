import { requireTeam, initials } from "@/lib/auth";
import { Header } from "@/components/nav/header";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireTeam();
  return (
    <>
      <Header width="max-w-3xl" initials={initials(user)} avatarUrl={user.avatarUrl} accountHref="/admin/parametres" right={<span className="mr-1 text-xs text-text">Équipe</span>} />
      <AdminNav role={user.role} />
      {children}
    </>
  );
}
