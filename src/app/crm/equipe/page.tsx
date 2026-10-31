import { UsersIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { SectionTitle } from "@/components/ui/card";
import { PIPELINE, teamName } from "@/lib/crm";
import { EQUIPE, ROLE_LABEL } from "@/lib/roles";
import { AddMemberForm, RemoveButton, RoleSelect } from "./form";

export const metadata = { title: "Équipe" };

/** Membres de l'équipe et leurs rôles (Direction seulement). */
export default async function EquipePage() {
  const me = await requireAdmin();
  const members = await prisma.user.findMany({
    where: { role: { in: EQUIPE } },
    orderBy: [{ role: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, email: true, role: true, _count: { select: { crmProspects: { where: { statut: { in: PIPELINE } } }, clientsSuivis: true, clientsDeveloppes: true } } },
  });
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl">Équipe</h1>
      <p className="mt-1 text-sm text-text">Chaque rôle ouvre ses modules : {ROLE_LABEL.ADMIN} (tout), {ROLE_LABEL.COMMERCIAL} (Prospection et Suivi), {ROLE_LABEL.DEV}, {ROLE_LABEL.EXPERT} et {ROLE_LABEL.SPECIALISTE} (Suivi). Les clients ne voient que leur espace.</p>
      <SectionTitle icon={UsersIcon}>Membres</SectionTitle>
      <ul className="divide-y divide-border rounded-card border border-border bg-surface">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-title">{[m.firstName, m.lastName].filter(Boolean).join(" ") || teamName(m)}</p>
              <p className="truncate text-xs text-text">{m.email} · {m._count.crmProspects} prospect{m._count.crmProspects > 1 ? "s" : ""} en cours · {m._count.clientsSuivis + m._count.clientsDeveloppes} client{m._count.clientsSuivis + m._count.clientsDeveloppes > 1 ? "s" : ""}</p>
            </div>
            <RoleSelect id={m.id} role={m.role} self={m.id === me.id} />
            {m.id !== me.id && <RemoveButton id={m.id} name={m.firstName ?? m.email} />}
          </li>
        ))}
      </ul>
      <SectionTitle>Ajouter un membre</SectionTitle>
      <AddMemberForm />
    </main>
  );
}
