import Link from "next/link";
import { AlertTriangleIcon, BotIcon, CreditCardIcon, FileSignatureIcon, GlobeIcon, HistoryIcon, LockIcon, MapPinIcon, MessageSquareIcon, PhoneIcon, StarIcon, UserCheckIcon, UsersIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SITE_STATUS, stepLabel } from "@/lib/labels";
import { fmtDate, fmtPrice } from "@/lib/format";
import { contactName, fmtDayTime, teamName } from "@/lib/crm";
import { CONTRAT_STATUT, MOYEN_PAIEMENT_LABEL } from "@/lib/contrats";
import { enBref } from "@/lib/en-bref";
import { timelineClient, CANAUX_CONTACT } from "@/lib/timeline";
import { JOURS_SANS_CONTACT } from "@/lib/alertes";
import { InfosForm, LegalForm, NoteInterneForm, SyntheseButton } from "../forms";
import { SuiviForm } from "../suivi-forms";
import { MODULES } from "@/lib/roles";
import { parisDay } from "@/lib/crm";
import { can } from "@/lib/permissions";
import { agitCommeReferent } from "@/lib/delegations";
import { lien, type Ctx } from "./ctx";
import { BoutonAppel } from "@/components/crm/bouton-appel";

/** Page principale (4.2) : identité, contacts, contrats, sites, référent, dernières interactions, alertes, finance, notes internes, En bref / synthèse IA. */
export async function Apercu({ clientId, me, finance, externe, ia }: Ctx & { ia: boolean }) {
  const now = new Date();
  const [client, bref, interactions, taches, rdvs, docsAttendus, commandes, modifs, notes, synthese, delegations] = await Promise.all([
    prisma.client.findUniqueOrThrow({ where: { id: clientId }, include: {
      sites: { orderBy: { createdAt: "asc" }, include: { developpeur: { select: { firstName: true, email: true } }, subscriptions: { where: { status: "ACTIF" }, select: { label: true } } } },
      contrats: { orderBy: { createdAt: "desc" }, select: { id: true, reference: true, titre: true, statut: true, formule: true, montantMensuelHt: true, montantPonctuelHt: true, moyenPaiement: true, signeAt: true, debutEngagement: true, finEngagement: true, preavisJours: true, reconductionMois: true, premierPaiementAt: true, impayeAt: true, regulariseAt: true, parentId: true, site: { select: { name: true } } } },
      contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }] },
      crmProspect: { select: { id: true, contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }] } } },
      commercial: { select: { id: true, firstName: true, email: true } },
    } }),
    enBref(clientId, { finance }),
    timelineClient(clientId, { canaux: CANAUX_CONTACT, limite: 6 }),
    prisma.tacheClient.findMany({ where: { clientId, statut: "A_FAIRE" }, orderBy: [{ echeance: { sort: "asc", nulls: "last" } }], take: 8, include: { responsable: { select: { firstName: true, email: true } } } }),
    prisma.rendezVous.findMany({ where: { clientId, resultat: "PREVU", debut: { gte: now } }, orderBy: { debut: "asc" }, take: 3 }),
    prisma.documentRequest.findMany({ where: { clientId, status: "EN_ATTENTE", direction: "VERS_CLIENT" }, include: { site: { select: { name: true } }, requester: { select: { firstName: true, email: true } } } }),
    prisma.order.findMany({ where: { clientId, status: "A_TRAITER" }, include: { offer: { select: { name: true } }, site: { select: { name: true } } } }),
    prisma.changeRequest.findMany({ where: { site: { clientId }, status: { in: ["RECUE", "A_VALIDER"] } }, include: { site: { select: { name: true } } }, take: 8 }),
    externe ? [] : prisma.echange.findMany({ where: { clientId, type: "NOTE", origine: "saisie" }, orderBy: { date: "desc" }, take: 5, include: { auteur: { select: { firstName: true, email: true } } } }),
    prisma.setting.findUnique({ where: { key: `synthese_client:${clientId}` } }),
    client_delegations(clientId),
  ]);
  const equipe = externe ? [] : await prisma.user.findMany({ where: { role: { in: MODULES.suivi } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true, role: true } });
  const peutAttribuer = !externe && (can(me, "attribuer") || (await agitCommeReferent(me.id, client)));
  const contacts = dedupe([...client.contacts, ...(client.crmProspect?.contacts ?? [])]);
  const synth = synthese ? (JSON.parse(synthese.value) as { texte: string; at: string; par: string }) : null;
  const alertes = [
    ...taches.filter((t) => t.echeance && t.echeance < now).map((t) => ({ tone: "pink" as const, texte: `Tâche en retard : ${t.titre}`, href: lien(clientId, "taches") })),
    ...(finance ? client.contrats.filter((c) => c.impayeAt && !c.regulariseAt).map((c) => ({ tone: "pink" as const, texte: `Impayé signalé sur ${c.reference}`, href: `/admin/contrats/${c.id}` })) : []),
    ...modifs.map((m) => ({ tone: "yellow" as const, texte: `Demande de modification : ${m.title} (${m.site.name})`, href: "/admin/modifications" })),
    ...commandes.map((o) => ({ tone: "yellow" as const, texte: `Commande à traiter : ${o.offer.name}${o.site ? ` pour ${o.site.name}` : ""}`, href: "/admin/commandes" })),
    ...docsAttendus.map((d) => ({ tone: "yellow" as const, texte: `Attendu du client : ${d.kind.toLowerCase()}${d.site ? ` (${d.site.name})` : ""}${d.message ? ` · ${d.message}` : ""}`, href: `/admin/clients/${clientId}/documents` })),
    ...taches.filter((t) => t.type === "RDV_A_PLANIFIER").map((t) => ({ tone: "blue" as const, texte: `RDV à fixer : ${t.titre}`, href: lien(clientId, "taches") })),
    ...(externe ? [] : client.contrats.filter((c) => c.statut === "ENVOYE" || c.statut === "CONSULTE").map((c) => ({ tone: "blue" as const, texte: `Contrat ${c.reference} ${CONTRAT_STATUT[c.statut].label.toLowerCase()}, non signé`, href: `/admin/contrats/${c.id}` }))),
    ...(externe ? [] : client.contrats.filter((c) => c.statut === "SIGNE" && c.finEngagement && c.finEngagement > now && c.finEngagement.getTime() - now.getTime() < 90 * 86400_000).map((c) => ({ tone: "blue" as const, texte: `Échéance ${c.reference} le ${fmtDate(c.finEngagement!)} (préavis ${c.preavisJours} j)`, href: `/admin/contrats/${c.id}` }))),
    ...((bref.jours === null || bref.jours >= JOURS_SANS_CONTACT) && bref.rdvAVenir === 0 ? [{ tone: "pink" as const, texte: `Aucun échange depuis ${bref.jours === null ? "le début" : `${bref.jours} jours`}, pas de RDV prévu`, href: lien(clientId, "taches") }] : []),
  ];
  const mensuel = client.contrats.filter((c) => c.statut === "SIGNE").reduce((a, c) => a + c.montantMensuelHt, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        {/* 7. Alertes et actions nécessaires : en tête, priorité à ce qui est réellement à faire */}
        {alertes.length > 0 && (
          <section className="mb-5 rounded-card border border-border bg-surface p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text uppercase"><AlertTriangleIcon size={13} aria-hidden /> Actions nécessaires ({alertes.length})</p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {alertes.map((a, i) => <li key={i}><Link href={a.href} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2"><span className={`mt-1.5 size-2 shrink-0 rounded-full bg-${a.tone}`} aria-hidden /><span className="text-text-strong">{a.texte}</span></Link></li>)}
            </ul>
          </section>
        )}

        {/* 1. Identité */}
        <SectionTitle icon={UsersIcon} action={externe ? undefined : <InfosForm client={{ id: client.id, name: client.name, address: client.address, phone: client.phone, email: client.email, siren: client.siren, secteur: client.secteur }} />}>Identité</SectionTitle>
        <Card className="space-y-2">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {client.phone && <BoutonAppel tel={client.phone} className="flex items-center gap-1.5 text-title hover:underline"><PhoneIcon size={14} className="text-text" aria-hidden /> {client.phone}</BoutonAppel>}
            {client.email && <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(client.email)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-title hover:underline"><MessageSquareIcon size={14} className="text-text" aria-hidden /> {client.email}</a>}
            {client.address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-text-strong hover:underline"><MapPinIcon size={14} className="text-text" aria-hidden /> {client.address}</a>}
            {client.siren && <span className="text-text">SIREN {client.siren}</span>}
            {client.gmbUrl && <a href={client.gmbUrl} target="_blank" rel="noreferrer" className="text-text-strong hover:underline">Fiche Google</a>}
            {client.sites.filter((s) => s.url).map((s) => <a key={s.id} href={s.url!} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-text-strong hover:underline"><GlobeIcon size={13} aria-hidden /> {s.url!.replace(/^https?:\/\//, "")}</a>)}
          </div>
          {!client.phone && !client.email && !client.address && <p className="text-xs text-muted">Coordonnées non renseignées.</p>}
        </Card>

        {/* 1 bis. Informations légales : base des contrats générés automatiquement. */}
        <SectionTitle icon={FileSignatureIcon} action={externe ? undefined : <LegalForm client={{ id: client.id, siret: client.siret, siren: client.siren, formeJuridique: client.formeJuridique, tvaIntra: client.tvaIntra, rcsVille: client.rcsVille, capitalEuros: client.capitalEuros, representantNom: client.representantNom, representantFonction: client.representantFonction, address: client.address }} />}>Informations légales</SectionTitle>
        <Card>
          {(() => {
            const lignes = [
              client.formeJuridique && `${client.formeJuridique}${client.capitalEuros ? ` au capital de ${client.capitalEuros.toLocaleString("fr-FR")} €` : ""}`,
              client.siret ? `SIRET ${client.siret.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, "$1 $2 $3 $4")}` : client.siren ? `SIREN ${client.siren}` : null,
              client.rcsVille && `RCS ${client.rcsVille}`, client.tvaIntra && `TVA ${client.tvaIntra}`,
              client.representantNom && `Signataire : ${client.representantNom}${client.representantFonction ? `, ${client.representantFonction.toLowerCase()}` : ""}`,
              client.address && `Siège : ${client.address}`,
            ].filter(Boolean) as string[];
            const manque = [!client.siret && "SIRET", !client.formeJuridique && "forme juridique", !client.representantNom && "signataire", !client.address && "adresse du siège"].filter(Boolean) as string[];
            return (
              <>
                {lignes.length > 0 ? <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-strong">{lignes.map((l) => <li key={l}>{l}</li>)}</ul> : <p className="text-sm text-text">Aucune information légale renseignée.</p>}
                <p className="mt-2 text-xs text-muted">{manque.length ? `À compléter pour générer les contrats : ${manque.join(", ")}.` : "Complet : les contrats peuvent être générés avec ces informations."}</p>
              </>
            );
          })()}
        </Card>

        {/* 2. Contacts */}
        <SectionTitle icon={UserCheckIcon} action={<Link href={lien(clientId, "contacts")} className="text-sm text-text hover:text-title">Gérer</Link>}>Contacts ({contacts.length})</SectionTitle>
        {contacts.length === 0 ? <p className="text-sm text-text">Aucun interlocuteur enregistré. <Link href={lien(clientId, "contacts")} className="underline-offset-2 hover:underline">Ajouter</Link></p> : (
          <ul className="divide-y divide-border rounded-card border border-border bg-surface">
            {contacts.slice(0, 4).map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold text-title">{contactName(c) ?? "Contact"}{c.principal && <StarIcon size={12} className="shrink-0 fill-yellow text-yellow" aria-label="Contact principal" />}{c.optOutCommercial && <Badge tone="neutral">désinscrit</Badge>}</p>
                  <p className="truncate text-xs text-text">{[c.fonction, c.telephone, c.email].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                {c.telephone && <BoutonAppel tel={c.telephone} className="text-xs text-text hover:text-title">Appeler</BoutonAppel>}
                {c.email && <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(c.email)}`} target="_blank" rel="noreferrer" className="text-xs text-text hover:text-title">Écrire</a>}
              </li>
            ))}
            {contacts.length > 4 && <li className="px-3 py-2 text-xs"><Link href={lien(clientId, "contacts")} className="text-text hover:text-title">+ {contacts.length - 4} autre{contacts.length - 4 > 1 ? "s" : ""}</Link></li>}
          </ul>
        )}

        {/* 3. Abonnements et contrats : un ensemble, jamais une colonne unique */}
        {!externe && (
          <>
            <SectionTitle icon={FileSignatureIcon} action={<Link href={lien(clientId, "contrats")} className="text-sm text-text hover:text-title">Tous les contrats</Link>}>Contrats ({client.contrats.length})</SectionTitle>
            {client.contrats.length === 0 ? <p className="text-sm text-text">Aucun contrat. <Link href={`/admin/contrats/nouveau?client=${clientId}`} className="underline-offset-2 hover:underline">Nouveau contrat</Link></p> : (
              <div className="grid gap-2 sm:grid-cols-2">
                {client.contrats.slice(0, 4).map((c) => (
                  <Card key={c.id} href={`/admin/contrats/${c.id}`} className="py-3">
                    <div className="flex items-start justify-between gap-2"><p className="truncate font-semibold text-title">{c.reference}{c.parentId ? " (avenant)" : ""}</p><Badge tone={CONTRAT_STATUT[c.statut].tone}>{CONTRAT_STATUT[c.statut].label}</Badge></div>
                    <p className="truncate text-xs text-text">{c.titre}{c.site ? ` · ${c.site.name}` : ""}</p>
                    <p className="mt-1 text-sm text-text-strong">{c.formule ?? "—"}{finance ? ` · ${fmtPrice(c.montantMensuelHt)} HT / mois${c.montantPonctuelHt ? ` + ${fmtPrice(c.montantPonctuelHt)} ponctuel` : ""}` : ""}</p>
                    <p className="text-xs text-text">{c.signeAt ? `Signé le ${fmtDate(c.signeAt)}` : "Non signé"}{c.debutEngagement ? ` · du ${fmtDate(c.debutEngagement)}` : ""}{c.finEngagement ? ` au ${fmtDate(c.finEngagement)}` : ""}{c.finEngagement ? ` · reconduction ${c.reconductionMois} mois, préavis ${c.preavisJours} j` : ""}</p>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* 4. Sites */}
        <SectionTitle icon={GlobeIcon} action={<Link href={lien(clientId, "sites")} className="text-sm text-text hover:text-title">Détail des sites</Link>}>Sites ({client.sites.length})</SectionTitle>
        {client.sites.length === 0 ? <p className="text-sm text-text">Aucun site.</p> : (
          <div className="grid gap-2">
            {client.sites.map((s) => (
              <Card key={s.id} href={`/admin/sites/${s.id}`} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-title">{s.name}</p>
                  <p className="truncate text-xs text-text">{s.status === "EN_CREATION" ? `Étape : ${stepLabel(s.projectStep)}` : s.url ?? "—"}{s.developpeur ? ` · ${teamName(s.developpeur)}` : " · pas de développeur"}{s.contratId ? "" : " · pas de contrat lié"}</p>
                  {s.subscriptions.length > 0 && <p className="mt-0.5 truncate text-xs text-text-strong">{s.subscriptions.map((x) => x.label).join(" · ")}</p>}
                </div>
                <Badge tone={SITE_STATUS[s.status].tone}>{SITE_STATUS[s.status].label}</Badge>
              </Card>
            ))}
          </div>
        )}

        {/* 6. Dernières interactions */}
        <SectionTitle icon={HistoryIcon} action={<Link href={lien(clientId, "activite")} className="text-sm text-text hover:text-title">Toute l’activité</Link>}>Dernières interactions</SectionTitle>
        {interactions.length === 0 ? <p className="text-sm text-text">Aucun échange tracé (email, appel, RDV, compte rendu).</p> : (
          <ul className="divide-y divide-border rounded-card border border-border bg-surface text-sm">
            {interactions.map((i) => (
              <li key={i.id} className="px-3 py-2">
                <Link href={`${lien(clientId, i.canal === "email" ? "emails" : i.canal === "appel" ? "appels" : "activite")}`} className="block">
                  <p className="truncate text-title">{i.titre}</p>
                  <p className="truncate text-xs text-text">{fmtDayTime(i.date)}{i.auteur ? ` · ${i.auteur}` : ""}{i.contact ? ` · ${i.contact}` : ""}{i.texte ? ` · ${i.texte.slice(0, 90)}` : ""}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="min-w-0 space-y-5">
        {/* 10. En bref / synthèse IA */}
        <section className="rounded-card border border-border bg-surface p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text uppercase"><BotIcon size={13} aria-hidden /> En bref</p>
          <ul className="mt-2 space-y-1 text-sm text-text-strong">{bref.faits.map((f, i) => <li key={i}>{f}</li>)}</ul>
          {bref.alertes.length > 0 && <ul className="mt-2 space-y-1 text-sm text-pink">{bref.alertes.map((f, i) => <li key={i}>{f}</li>)}</ul>}
          {bref.opportunites.length > 0 && <ul className="mt-2 space-y-1 text-sm text-green">{bref.opportunites.map((f, i) => <li key={i}>{f}</li>)}</ul>}
          {ia && (
            <div className="mt-3 border-t border-border pt-3">
              {synth && <div className="mb-2 text-sm whitespace-pre-line text-text-strong">{synth.texte}<p className="mt-1 text-[11px] text-muted">Synthèse IA du {fmtDayTime(synth.at)} par {synth.par} : faits et hypothèses distingués, à relire.{interactions.some((i) => i.date > new Date(synth.at)) && <span className="text-yellow"> Des échanges plus récents existent : à actualiser.</span>}</p></div>}
              <SyntheseButton clientId={clientId} existe={!!synth} />
            </div>
          )}
        </section>

        {/* 5. Commercial référent */}
        <section className="rounded-card border border-border bg-surface p-4 text-sm">
          <p className="text-xs font-semibold tracking-wide text-text uppercase">Référent</p>
          <p className="mt-1 font-semibold text-title">{client.commercial ? teamName(client.commercial) : "Personne"}</p>
          {client.commercial && <p className="text-xs text-text">{client.commercial.email}</p>}
          {delegations.map((d) => <p key={d.id} className="mt-1 text-xs text-violet">Délégué à {teamName(d.vers)} jusqu’au {fmtDate(d.fin)}{d.motif ? ` (${d.motif})` : ""}</p>)}
          <p className="mt-2 text-xs"><Link href={lien(clientId, "taches")} className="text-text hover:text-title">Tâches et RDV</Link>{!externe && <> · <Link href={lien(clientId, "contacts")} className="text-text hover:text-title">Réattribuer</Link></>}</p>
          {!externe && <div className="mt-3 border-t border-border pt-3"><SuiviForm client={{ id: client.id, formule: client.formule, engagementDebut: client.engagementDebut ? parisDay(client.engagementDebut) : "", engagementFin: client.engagementFin ? parisDay(client.engagementFin) : "", gmbUrl: client.gmbUrl, commercialId: client.commercialId, developpeurId: client.developpeurId, reference: client.reference }} commerciaux={equipe.filter((u) => MODULES.prospection.includes(u.role)).map((u) => ({ id: u.id, name: teamName(u) }))} devs={equipe.filter((u) => u.role !== "COMMERCIAL").map((u) => ({ id: u.id, name: teamName(u) }))} peutAttribuer={peutAttribuer} /></div>}
        </section>

        {/* À venir */}
        {(rdvs.length > 0 || taches.length > 0) && (
          <section className="rounded-card border border-border bg-surface p-4 text-sm">
            <p className="text-xs font-semibold tracking-wide text-text uppercase">À venir</p>
            <ul className="mt-2 space-y-1.5">
              {rdvs.map((r) => <li key={r.id} className="text-text-strong">RDV {fmtDayTime(r.debut)}{r.titre ? ` : ${r.titre}` : ""}</li>)}
              {taches.slice(0, 5).map((t) => <li key={t.id} className={t.echeance && t.echeance < now ? "text-pink" : "text-text-strong"}>{t.titre}{t.echeance ? ` · ${fmtDate(t.echeance)}` : ""}{t.responsable ? ` · ${teamName(t.responsable)}` : ""}</li>)}
            </ul>
          </section>
        )}

        {/* 8. Finance (V1 : saisie manuelle, droits) */}
        {finance && !externe && (
          <section className="rounded-card border border-border bg-surface p-4 text-sm">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text uppercase"><CreditCardIcon size={13} aria-hidden /> Finance</p>
            <p className="mt-1 font-title text-xl font-extrabold text-title">{fmtPrice(mensuel)} <span className="text-xs font-normal text-text">HT / mois (contrats signés)</span></p>
            <ul className="mt-2 space-y-1 text-xs text-text">
              {client.contrats.filter((c) => c.statut === "SIGNE").map((c) => <li key={c.id}>{c.reference} · {c.moyenPaiement ? MOYEN_PAIEMENT_LABEL[c.moyenPaiement] : "moyen de paiement non précisé"} · {c.premierPaiementAt ? `1er paiement reçu le ${fmtDate(c.premierPaiementAt)}` : <span className="text-pink">1er paiement non reçu</span>}{c.impayeAt && !c.regulariseAt ? <span className="text-pink"> · impayé</span> : ""}</li>)}
              {client.contrats.filter((c) => c.statut === "SIGNE").length === 0 && <li>Aucun contrat signé.</li>}
            </ul>
            <p className="mt-2 text-[11px] text-muted">Les factures restent dans Pennylane.</p>
          </section>
        )}

        {/* 9. Notes internes */}
        {!externe && (
          <section className="rounded-card border border-border bg-surface p-4 text-sm">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-text uppercase"><LockIcon size={13} aria-hidden /> Notes internes</p>
            <ul className="mt-2 space-y-2">
              {notes.length === 0 && <li className="text-xs text-text">Aucune note. Visible de l’équipe seulement, jamais du client ni des prestataires.</li>}
              {notes.map((n) => <li key={n.id}><p className="whitespace-pre-line text-text-strong">{n.notes}</p><p className="text-[11px] text-muted">{fmtDayTime(n.date)}{n.auteur ? ` · ${teamName(n.auteur)}` : ""}</p></li>)}
            </ul>
            <NoteInterneForm clientId={clientId} />
          </section>
        )}
      </aside>
    </div>
  );
}

async function client_delegations(clientId: string) {
  const c = await prisma.client.findUnique({ where: { id: clientId }, select: { commercialId: true } });
  if (!c?.commercialId) return [];
  const now = new Date();
  return prisma.delegation.findMany({ where: { deId: c.commercialId, debut: { lte: now }, fin: { gte: now }, OR: [{ clientId: null }, { clientId }] }, include: { vers: { select: { firstName: true, email: true } } } });
}
export function dedupe<T extends { id: string }>(xs: T[]) { const seen = new Set<string>(); return xs.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true))); }
