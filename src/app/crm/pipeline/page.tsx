import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { PIPELINE, contactName, teamName } from "@/lib/crm";
import { Board, type CardData } from "./board";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const me = await requireTeam();
  const { c } = await searchParams;
  const [prospects, team, cibles] = await Promise.all([
    prisma.prospect.findMany({
      where: { statut: { in: PIPELINE } },
      orderBy: [{ relanceAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      select: {
        id: true, societe: true, statut: true, relanceAt: true, telephone: true, siteWeb: true, commercialId: true,
        cible: { select: { nom: true } },
        contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }], take: 1, select: { prenom: true, nom: true, telephone: true } },
      },
    }),
    prisma.user.findMany({ where: { role: { in: ["ADMIN", "COMMERCIAL"] } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true, avatarUrl: true } }),
    prisma.cible.findMany({ orderBy: { nom: "asc" }, select: { nom: true } }),
  ]);
  const cards: CardData[] = prospects.map((p) => ({
    id: p.id, societe: p.societe, statut: p.statut, relanceAt: p.relanceAt?.toISOString() ?? null,
    contact: contactName(p.contacts[0]), telephone: p.contacts[0]?.telephone ?? p.telephone, siteWeb: p.siteWeb,
    cible: p.cible?.nom ?? null, commercialId: p.commercialId,
  }));
  return (
    <Board
      initial={cards}
      team={team.map((u) => ({ id: u.id, name: teamName(u), avatarUrl: u.avatarUrl }))}
      cibles={cibles.map((x) => x.nom)}
      meId={me.id}
      initialFilter={c === "all" ? "all" : c ?? "all"}
    />
  );
}
