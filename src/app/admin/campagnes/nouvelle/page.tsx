import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { estExterne } from "@/lib/permissions";
import { AdminPage } from "@/components/admin/page";
import { MODELES, VARIABLES } from "@/lib/campagnes";
import { MODULES } from "@/lib/roles";
import { teamName } from "@/lib/crm";
import { CampagneForm } from "../form";

export const metadata = { title: "Nouvelle campagne" };

export default async function NouvelleCampagnePage({ searchParams }: { searchParams: Promise<{ clients?: string }> }) {
  const me = await requireTeam();
  if (estExterne(me)) redirect("/admin");
  const sp = await searchParams;
  const commerciaux = await prisma.user.findMany({ where: { role: { in: MODULES.prospection } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true } });
  const ids = (sp.clients ?? "").split(",").filter(Boolean);
  return (
    <AdminPage title="Nouvelle campagne" back={{ href: "/admin/campagnes", label: "Campagnes" }}>
      {ids.length > 0 && <p className="mb-3 rounded-card border border-border bg-surface px-4 py-2 text-sm text-text">Sélection depuis le tableau Clients : {ids.length} client{ids.length > 1 ? "s" : ""}.</p>}
      <CampagneForm init={{ titre: "", objet: "", corpsHtml: "", commercial: true, plafond: 50 }} modeles={MODELES} commerciaux={commerciaux.map((u) => ({ id: u.id, name: teamName(u) }))} clientIds={ids.length ? ids.join(",") : undefined} variables={VARIABLES} />
    </AdminPage>
  );
}
