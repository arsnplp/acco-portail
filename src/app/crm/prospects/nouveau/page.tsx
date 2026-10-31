import { prisma } from "@/lib/prisma";
import { MODULES } from "@/lib/roles";
import { requireProspection } from "@/lib/auth";
import { parisDay, teamName } from "@/lib/crm";
import { NewProspectForm } from "./form";

export const metadata = { title: "Nouveau prospect" };

export default async function NewProspectPage() {
  const me = await requireProspection();
  const [team, cibles] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: MODULES.prospection } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true } }),
    prisma.cible.findMany({ orderBy: { nom: "asc" }, select: { nom: true } }),
  ]);
  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-2xl">Nouveau prospect</h1>
      <p className="mt-1 text-sm text-text">Si la société existe déjà (prospect ou client), on vous ouvre sa fiche au lieu d’en créer une deuxième.</p>
      <NewProspectForm meId={me.id} team={team.map((u) => ({ id: u.id, name: teamName(u) }))} cibles={cibles.map((c) => c.nom)} today={parisDay()} isAdmin={me.role === "ADMIN"} />
    </main>
  );
}
