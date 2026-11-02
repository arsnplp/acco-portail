import Link from "next/link";
import { FileSignatureIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { can, estExterne } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { AdminPage } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { CONTRAT_STATUT } from "@/lib/contrats";
import { daysUntil, fmtDate, fmtPrice } from "@/lib/format";
import { teamName, matchRecherche } from "@/lib/crm";
import { cn } from "@/lib/cn";
import type { ContratStatut } from "@prisma/client";

export const metadata = { title: "Contrats" };
const VUES: Array<[string, string, ContratStatut[] | null]> = [["ouverts", "En cours", ["BROUILLON", "ENVOYE", "CONSULTE"]], ["signes", "Signés", ["SIGNE"]], ["tous", "Tous", null]];

/** Tous les contrats (prospects et clients) : statut, montants (droit finance), signature, échéances. */
export default async function ContratsPage({ searchParams }: { searchParams: Promise<{ vue?: string; q?: string }> }) {
  const me = await requireTeam();
  if (estExterne(me)) redirect("/admin");
  const sp = await searchParams;
  const vue = VUES.find(([k]) => k === sp.vue) ?? VUES[0];
  const q = (sp.q ?? "").trim();
  const finance = can(me, "finance");
  const contrats = await prisma.contrat.findMany({
    where: vue[2] ? { statut: { in: vue[2] } } : {}, orderBy: { createdAt: "desc" }, take: 300,
    include: { client: { select: { id: true, name: true } }, prospect: { select: { id: true, societe: true } }, commercial: { select: { firstName: true, email: true } }, site: { select: { name: true } } },
  });
  const visibles = contrats.filter((c) => matchRecherche(q, [c.reference, c.titre, c.client?.name, c.prospect?.societe]));
  return (
    <AdminPage title="Contrats" action={<Link href="/admin/clients" className="text-sm text-text hover:text-title">Nouveau contrat : depuis une fiche prospect ou client</Link>}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-border p-0.5 text-sm">{VUES.map(([k, l]) => <Link key={k} href={`/admin/contrats?vue=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={cn("rounded-full px-3 py-1.5", vue[0] === k ? "bg-title font-semibold text-bg" : "text-text hover:text-title")}>{l}</Link>)}</div>
        <form method="get" action="/admin/contrats" className="flex flex-1 gap-2"><input type="hidden" name="vue" value={vue[0]} /><input name="q" defaultValue={q} placeholder="Référence, titre, société" className="h-10 min-w-40 flex-1 rounded-full border border-border bg-surface px-4 text-sm text-title outline-none placeholder:text-muted focus:border-blue" /><button type="submit" className="h-10 rounded-full border border-border px-4 text-sm text-text hover:text-title">Filtrer</button></form>
      </div>
      {visibles.length === 0 ? <Empty icon={FileSignatureIcon} title="Aucun contrat" text="Le générateur se lance depuis la fiche d’un prospect (Prospection) ou d’un client (Suivi)." /> : (
        <div className="grid gap-2">
          {visibles.map((c) => {
            const j90 = c.statut === "SIGNE" && !!c.finEngagement && daysUntil(c.finEngagement) > 0 && daysUntil(c.finEngagement) <= 90;
            return (
              <Card key={c.id} href={`/admin/contrats/${c.id}`} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-title">{c.reference}</span>
                  <Badge tone={CONTRAT_STATUT[c.statut].tone}>{CONTRAT_STATUT[c.statut].label}</Badge>
                  {c.parentId && <Badge tone="neutral">avenant</Badge>}
                  {c.impayeAt && !c.regulariseAt && <Badge tone="pink">impayé</Badge>}
                  {j90 && <Badge tone="yellow">échéance le {fmtDate(c.finEngagement!)}</Badge>}
                  <span className="min-w-0 flex-1 truncate text-sm text-text-strong">{c.client?.name ?? c.prospect?.societe ?? "—"} · {c.titre}{c.site ? ` · ${c.site.name}` : ""}</span>
                </div>
                <p className="mt-1 text-xs text-text">{finance ? `${fmtPrice(c.montantMensuelHt)} HT / mois${c.montantPonctuelHt ? ` + ${fmtPrice(c.montantPonctuelHt)}` : ""} · ` : ""}{c.commercial ? `${teamName(c.commercial)} · ` : ""}{c.signeAt ? `signé le ${fmtDate(c.signeAt)}` : c.envoyeAt ? `envoyé le ${fmtDate(c.envoyeAt)}` : `créé le ${fmtDate(c.createdAt)}`}{c.statut === "SIGNE" && !c.premierPaiementAt ? " · 1er paiement non reçu" : ""}</p>
              </Card>
            );
          })}
        </div>
      )}
    </AdminPage>
  );
}
