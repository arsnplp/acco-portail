import { HeartHandshakeIcon, StarIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtDate } from "@/lib/format";
import type { Ctx } from "./ctx";

const STATUT = { ENVOYEE: ["Envoyée", "blue"], CONTACTEE: ["Contactée", "yellow"], SIGNEE: ["Signée", "green"], RECOMPENSE_VALIDEE: ["Récompense validée", "green"] } as const;

/** Onglet Satisfaction et parrainage (4.3, section 15) : recommandations faites, parrain éventuel, avis Google des sites, sollicitations d'avis. */
export async function SatisfactionOnglet({ clientId }: Ctx) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId }, include: {
    referralsMade: { orderBy: { createdAt: "desc" }, include: { referred: { select: { id: true, name: true } } } },
    referredBy: { include: { referrer: { select: { id: true, name: true } } } },
    reviewPrompts: { orderBy: { shownAt: "desc" }, take: 10 },
    sites: { select: { id: true, name: true, reviewAverage: true, reviewTotal: true, reviewsSyncedAt: true } },
  } });
  return (
    <div className="space-y-6">
      <SectionTitle icon={StarIcon}>Satisfaction</SectionTitle>
      <ul className="divide-y divide-border rounded-card border border-border bg-surface text-sm">
        {client.sites.map((s) => <li key={s.id} className="px-4 py-2"><span className="text-title">{s.name}</span> <span className="text-xs text-text">· {s.reviewAverage ? `${s.reviewAverage.toFixed(1)}/5 sur ${s.reviewTotal ?? 0} avis Google (relevé le ${s.reviewsSyncedAt ? fmtDate(s.reviewsSyncedAt) : "—"})` : "pas d’avis relevés (API Business Profile non activée ou fiche non liée)"}</span></li>)}
        {client.sites.length === 0 && <li className="px-4 py-2 text-text">Aucun site.</li>}
      </ul>
      {client.reviewPrompts.length > 0 && <p className="text-xs text-text">Sollicitations d’avis affichées au client : {client.reviewPrompts.map((p) => `${p.trigger.toLowerCase().replace(/_/g, " ")} (${fmtDate(p.shownAt)}, ${p.state.toLowerCase()})`).join(" · ")}</p>}
      <p className="text-xs text-muted">Questionnaires de satisfaction : à mettre en place (section 15, non tranché) ; aucun score n’est inventé.</p>

      <SectionTitle icon={HeartHandshakeIcon}>Parrainage</SectionTitle>
      {client.referredBy && <p className="text-sm text-text">Client parrainé par <span className="font-semibold text-text-strong">{client.referredBy.referrer.name}</span>.</p>}
      {client.referralsMade.length === 0 ? <p className="text-sm text-text">Aucune recommandation envoyée par ce client. Code de parrainage : <span className="font-mono text-text-strong">{client.referralCode}</span></p> : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface text-sm">
          {client.referralsMade.map((r) => <li key={r.id} className="flex items-center gap-2 px-4 py-2"><div className="min-w-0 flex-1"><p className="truncate text-title">{r.contactName ?? "Contact"}{r.referred ? ` → client ${r.referred.name}` : ""}</p><p className="truncate text-xs text-text">{fmtDate(r.createdAt)}{r.contactPhone ? ` · ${r.contactPhone}` : ""}{r.contactEmail ? ` · ${r.contactEmail}` : ""}{r.rewardLabel ? ` · récompense : ${r.rewardLabel}` : ""}</p></div><Badge tone={STATUT[r.status][1]}>{STATUT[r.status][0]}</Badge></li>)}
        </ul>
      )}
    </div>
  );
}
