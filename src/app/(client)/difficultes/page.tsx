import { LifeBuoyIcon } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";
import { DIFFICULTE_STATUT, DIFFICULTE_TYPE } from "@/lib/difficultes";
import { DifficulteForm } from "./form";

export const metadata = { title: "Signaler une difficulté" };

/** Signaler une difficulté : formulaire court, puis suivi reçue → en cours → résolue avec la réponse de l'équipe. */
export default async function DifficultesPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const { client } = await requireClientContext();
  const { site } = await searchParams;
  const [sites, liste] = await Promise.all([
    prisma.site.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    prisma.difficulte.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" }, take: 30, include: { site: { select: { name: true } } } }),
  ]);
  const ouvertes = liste.filter((d) => d.statut !== "RESOLUE"), closes = liste.filter((d) => d.statut === "RESOLUE");
  return (
    <Page title="Signaler une difficulté" subtitle="Un problème, une question urgente ? Dites-le nous ici : c’est suivi jusqu’à la résolution.">
      <DifficulteForm sites={sites} siteId={site} />
      {ouvertes.length > 0 && (
        <>
          <SectionTitle icon={LifeBuoyIcon}>En cours ({ouvertes.length})</SectionTitle>
          <div className="grid gap-2">{ouvertes.map((d) => <Ligne key={d.id} d={d} />)}</div>
        </>
      )}
      {closes.length > 0 && (
        <>
          <SectionTitle>Résolues</SectionTitle>
          <div className="grid gap-2">{closes.map((d) => <Ligne key={d.id} d={d} />)}</div>
        </>
      )}
    </Page>
  );
}

function Ligne({ d }: { d: { id: string; type: keyof typeof DIFFICULTE_TYPE; statut: keyof typeof DIFFICULTE_STATUT; message: string; reponse: string | null; createdAt: Date; resoluAt: Date | null; site: { name: string } | null } }) {
  const st = DIFFICULTE_STATUT[d.statut];
  return (
    <Card className="py-3">
      <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-title">{DIFFICULTE_TYPE[d.type].label}{d.site ? ` · ${d.site.name}` : ""}</p><Badge tone={st.tone}>{st.label}</Badge></div>
      <p className="mt-1 whitespace-pre-line text-sm text-text-strong">{d.message}</p>
      <p className="mt-1 text-[11px] text-text">Envoyée le {fmtDate(d.createdAt)}{d.resoluAt ? ` · résolue le ${fmtDate(d.resoluAt)}` : ""}</p>
      {d.reponse && <div className="mt-2 rounded-lg border border-border bg-surface-2 p-2.5 text-sm text-text-strong"><span className="block text-[11px] font-semibold text-text">Réponse de l’équipe</span><span className="whitespace-pre-line">{d.reponse}</span></div>}
    </Card>
  );
}
