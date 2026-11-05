import Link from "next/link";
import { StarIcon, UserCheckIcon, ArrowLeftRightIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MODULES } from "@/lib/roles";
import { contactName, fmtDayTime, teamName } from "@/lib/crm";
import { timelineClient } from "@/lib/timeline";
import { ContactForm, ContactDeleteButton, ReattribuerForm } from "../forms";
import { dedupe } from "./apercu";
import { lien, type Ctx } from "./ctx";
import { BoutonAppel } from "@/components/crm/bouton-appel";

/** Onglet Contacts (4.3) : plusieurs interlocuteurs, contact principal, échanges reliés à chaque personne ; réattribution du référent. */
export async function ContactsOnglet({ clientId, externe, me }: Ctx) {
  const [client, equipe, timeline] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId }, include: { contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }] }, crmProspect: { select: { id: true, contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }] } } }, commercial: { select: { id: true, firstName: true, email: true } } } }),
    prisma.user.findMany({ where: { role: { in: MODULES.prospection } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true } }),
    timelineClient(clientId, { canaux: ["email", "appel"], limite: 300 }),
  ]);
  const contacts = dedupe([...client.contacts, ...(client.crmProspect?.contacts ?? [])]);
  return (
    <div className="space-y-6">
      <SectionTitle icon={UserCheckIcon}>Interlocuteurs ({contacts.length})</SectionTitle>
      <div className="grid gap-2">
        {contacts.length === 0 && <p className="text-sm text-text">Aucun interlocuteur. Un client peut en avoir plusieurs : gérant, assistante, comptable…</p>}
        {contacts.map((c) => {
          const nom = contactName(c) ?? "Contact";
          const siens = timeline.filter((t) => t.contact === nom).slice(0, 5);
          return (
            <details key={c.id} className="rounded-card border border-border bg-surface">
              <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold text-title">{nom}{c.principal && <StarIcon size={12} className="shrink-0 fill-yellow text-yellow" aria-label="Contact principal" />}{c.optOutCommercial && <Badge tone="neutral">désinscrit des messages commerciaux</Badge>}</p>
                  <p className="truncate text-xs text-text">{[c.fonction, c.telephone, c.email].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                {c.telephone && <BoutonAppel tel={c.telephone} className="text-xs text-text hover:text-title">Appeler</BoutonAppel>}
                {c.email && <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(c.email)}`} target="_blank" rel="noreferrer" className="text-xs text-text hover:text-title">Écrire</a>}
              </summary>
              <div className="grid gap-4 border-t border-border p-4 md:grid-cols-2">
                <ContactForm clientId={clientId} contact={{ id: c.id, prenom: c.prenom, nom: c.nom, fonction: c.fonction, email: c.email, telephone: c.telephone, principal: c.principal, optOut: c.optOutCommercial }} />
                <div>
                  <p className="text-xs font-semibold tracking-wide text-text uppercase">Échanges avec {nom}</p>
                  {siens.length === 0 ? <p className="mt-1 text-xs text-text">Aucun email ni appel relié à ce contact (rattachement par adresse email ou numéro).</p> : (
                    <ul className="mt-1 space-y-1 text-sm">{siens.map((t) => <li key={t.id}><Link href={lien(clientId, t.canal === "email" ? "emails" : "appels")} className="text-title hover:underline">{t.titre}</Link><span className="block text-xs text-text">{fmtDayTime(t.date)}</span></li>)}</ul>
                  )}
                  {!externe && <div className="mt-3"><ContactDeleteButton clientId={clientId} contactId={c.id} nom={nom} /></div>}
                </div>
              </div>
            </details>
          );
        })}
      </div>
      <SectionTitle>Ajouter un interlocuteur</SectionTitle>
      <ContactForm clientId={clientId} contact={null} />
      {!externe && (
        <>
          <SectionTitle icon={ArrowLeftRightIcon}>Commercial référent</SectionTitle>
          <p className="mb-2 text-sm text-text">Référent actuel : <span className="font-semibold text-text-strong">{client.commercial ? teamName(client.commercial) : "personne"}</span>. La réattribution est définitive et journalisée ; les tâches à faire et RDV à venir suivent le nouveau référent. Pour un remplacement temporaire, utilisez une délégation (page Équipe).</p>
          <ReattribuerForm clientId={clientId} actuel={client.commercialId} equipe={equipe.map((u) => ({ id: u.id, name: teamName(u) }))} meId={me.id} />
        </>
      )}
    </div>
  );
}
