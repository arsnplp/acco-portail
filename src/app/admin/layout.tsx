import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireTeam, initials } from "@/lib/auth";
import { can, estExterne } from "@/lib/permissions";
import { estCommercial } from "@/lib/roles";
import { Header } from "@/components/nav/header";
import { AdminNav } from "./admin-nav";
import { MessagesIcon } from "@/components/nav/messages-icon";
import { AircallDock } from "@/components/crm/aircall-dock";

/** Pages ouvertes aux prestataires et spécialistes (section 13) : leurs projets, la production, les validations qu'on leur confie, leurs paramètres. */
const EXTERNE_OK = ["/admin/suivi", "/admin/clients", "/admin/sites", "/admin/production", "/admin/modifications", "/admin/messages", "/admin/validations", "/admin/parametres", "/admin/taches", "/admin/blog"];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireTeam();
  const externe = estExterne(user);
  if (externe) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (pathname && pathname !== "/admin" && !EXTERNE_OK.some((p) => pathname === p || pathname.startsWith(p + "/"))) redirect("/admin/suivi");
  }
  return (
    <>
      <Header width="max-w-[1600px] lg:px-8" initials={initials(user)} avatarUrl={user.avatarUrl} accountHref="/admin/parametres" right={<><span className="mr-1 hidden text-xs text-text sm:inline">{externe ? "Prestataire" : "Équipe"}</span><MessagesIcon user={user} /></>} />
      <AdminNav role={user.role} externe={externe} direction={can(user, "pilotage")} commercial={estCommercial(user)} />
      {children}
      {!externe && <AircallDock />}
    </>
  );
}
