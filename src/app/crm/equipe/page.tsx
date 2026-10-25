import { UsersIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { SectionTitle } from "@/components/ui/card";
import { PIPELINE, teamName } from "@/lib/crm";
import { AddMemberForm, RemoveButton } from "./form";

export const metadata = { title: "Équipe" };

export default async function EquipePage() {
  await requireAdmin();
  const members = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "COMMERCIAL"] } },
    orderBy: [{ role: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, email: true, role: true, _count: { select: { crmProspects: { where: { statut: { in: PIPELINE } } } } } },
  });
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl">Équipe</h1>
      <p className="mt-1 text-sm text-text">Les commerciaux et alternants voient uniquement l’espace Commercial. Les admins voient tout.</p>
      <SectionTitle icon={UsersIcon}>Membres</SectionTitle>
      <ul className="divide-y divide-border rounded-card border border-border bg-surface">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-title">{[m.firstName, m.lastName].filter(Boolean).join(" ") || teamName(m)}</p>
              <p className="truncate text-xs text-text">{m.email} · {m._count.crmProspects} prospect{m._count.crmProspects > 1 ? "s" : ""} en cours</p>
            </div>
            <span className="rounded-full border border-border px-2.5 py-1 text-xs text-text">{m.role === "ADMIN" ? "Admin" : "Commercial"}</span>
            {m.role === "COMMERCIAL" && <RemoveButton id={m.id} name={m.firstName ?? m.email} />}
          </li>
        ))}
      </ul>
      <SectionTitle>Ajouter un alternant ou un commercial</SectionTitle>
      <AddMemberForm />
    </main>
  );
}
