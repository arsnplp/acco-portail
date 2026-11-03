import Link from "next/link";
import { redirect } from "next/navigation";
import { MailsIcon, PlusIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { estExterne } from "@/lib/permissions";
import { AdminPage } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { CAMPAGNE_STATUT } from "@/lib/campagnes";
import { fmtDayTime, teamName } from "@/lib/crm";

export const metadata = { title: "Campagnes" };

/** Envois groupés de petite taille (00.4) : liste, statut, résultats par destinataire. */
export default async function CampagnesPage() {
  const me = await requireTeam();
  if (estExterne(me)) redirect("/admin");
  const campagnes = await prisma.campagne.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { auteur: { select: { firstName: true, email: true } }, destinataires: { select: { statut: true } } } });
  return (
    <AdminPage title="Campagnes" action={<Button href="/admin/campagnes/nouvelle" size="sm"><PlusIcon size={16} /> Nouvelle campagne</Button>}>
      <p className="mb-4 text-sm text-text">Un email individuel par destinataire, envoyé par la boîte Gmail de l’auteur, après validation humaine. Plafond par envoi, étalement, désinscription, aucun suivi d’ouverture.</p>
      {campagnes.length === 0 ? <Empty icon={MailsIcon} title="Aucune campagne" text="Satisfaction, nouveautés, parrainage, clients sans nouvelles… ou une sélection depuis le tableau Clients." /> : (
        <div className="grid gap-2">
          {campagnes.map((c) => {
            const n = (s: string) => c.destinataires.filter((d) => d.statut === s).length;
            return (
              <Card key={c.id} href={`/admin/campagnes/${c.id}`} className="py-3">
                <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-title">{c.titre}</span><Badge tone={CAMPAGNE_STATUT[c.statut].tone}>{CAMPAGNE_STATUT[c.statut].label}</Badge>{!c.commercial && <Badge tone="neutral">message de service</Badge>}</div>
                <p className="mt-1 text-xs text-text">{c.objet} · {c.destinataires.length} destinataire{c.destinataires.length > 1 ? "s" : ""} ({n("ENVOYE")} envoyés, {n("EN_ATTENTE")} en attente, {n("ERREUR")} en erreur, {n("EXCLU")} exclus) · {c.auteur ? teamName(c.auteur) : "—"} · {fmtDayTime(c.createdAt)}</p>
              </Card>
            );
          })}
        </div>
      )}
      <p className="mt-6 text-xs text-muted"><Link href="/admin/clients" className="underline">Tableau Clients</Link> : filtrez, cochez, puis « Envoyer un email » pour cibler précisément.</p>
    </AdminPage>
  );
}
