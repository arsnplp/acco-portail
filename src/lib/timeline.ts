/**
 * Timeline générale d'un client (section 4.5) : appels, emails, RDV, comptes rendus, notes, demandes, livraisons et
 * interventions, contrats et paiements, tâches, parrainages, campagnes… Chaque événement pointe vers sa source.
 * Filtres : canal, période, collaborateur, site. Une communication synchronisée depuis plusieurs boîtes n'apparaît qu'une fois.
 */
import { prisma } from "@/lib/prisma";
import { ECHANGE, contactName, teamName } from "@/lib/crm";
import { isAircallMeta, isGmailMeta } from "@/lib/echange-meta";
import { CHANGE_STATUS } from "@/lib/labels";
import { CONTRAT_STATUT } from "@/lib/contrats";

export type Canal = "email" | "appel" | "rdv" | "compte_rendu" | "note" | "demande" | "production" | "contrat" | "tache" | "parrainage" | "campagne" | "document" | "autre";
export const CANAL_LABEL: Record<Canal, string> = {
  email: "Emails", appel: "Appels", rdv: "Rendez-vous", compte_rendu: "Comptes rendus", note: "Notes internes", demande: "Demandes", production: "Production et interventions",
  contrat: "Contrats et paiements", tache: "Tâches", parrainage: "Parrainage", campagne: "Campagnes", document: "Documents", autre: "Autre",
};
/** Canaux qui comptent comme un vrai contact avec le client (alerte 60 jours, « dernier contact »). */
export const CANAUX_CONTACT: Canal[] = ["email", "appel", "rdv", "compte_rendu"];

export type Evenement = {
  id: string; date: Date; canal: Canal; titre: string; texte: string | null; href: string | null;
  auteurId: string | null; auteur: string | null; siteId: string | null; contact: string | null; interne: boolean;
  /** Détail brut pour les vues spécialisées (emails, appels). */
  meta?: unknown; echangeId?: string;
};

export type FiltresTimeline = { canaux?: Canal[]; depuis?: Date | null; auteurId?: string | null; siteId?: string | null; limite?: number };

export async function timelineClient(clientId: string, f: FiltresTimeline = {}) {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, crmProspect: { select: { id: true } }, contacts: { select: { prenom: true, nom: true, email: true, telephone: true } } } });
  if (!client) return [] as Evenement[];
  const depuis = f.depuis ?? null;
  const dateWhere = depuis ? { gte: depuis } : undefined;
  const veut = (c: Canal) => !f.canaux || f.canaux.length === 0 || f.canaux.includes(c);
  const contactPar = (email?: string | null, tel?: string | null) => {
    const c = client.contacts.find((x) => (email && x.email && x.email.toLowerCase() === email.toLowerCase()) || (tel && x.telephone && x.telephone.replace(/\D/g, "").slice(-9) === tel.replace(/\D/g, "").slice(-9)));
    return c ? contactName(c) : null;
  };

  const [echanges, rdvs, activites, histo, demandes, taches, referrals, docs, contrats] = await Promise.all([
    prisma.echange.findMany({
      where: { OR: [{ clientId }, ...(client.crmProspect ? [{ prospectId: client.crmProspect.id }] : [])], ...(dateWhere && { date: dateWhere }), ...(f.auteurId && { auteurId: f.auteurId }) },
      orderBy: { date: "desc" }, take: 400, include: { auteur: { select: { firstName: true, email: true } } },
    }),
    veut("rdv") ? prisma.rendezVous.findMany({ where: { OR: [{ clientId }, ...(client.crmProspect ? [{ prospectId: client.crmProspect.id }] : [])], ...(dateWhere && { debut: dateWhere }), ...(f.auteurId && { commercialId: f.auteurId }), ...(f.siteId && { siteId: f.siteId }) }, orderBy: { debut: "desc" }, take: 100, include: { commercial: { select: { firstName: true, email: true } }, site: { select: { name: true } } } }) : [],
    prisma.activite.findMany({ where: { clientId, kind: { notIn: ["compte_rendu", "rappel", "alerte"] }, ...(dateWhere && { createdAt: dateWhere }), ...(f.auteurId && { userId: f.auteurId }), ...(f.siteId && { siteId: f.siteId }) }, orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { firstName: true, email: true } } } }),
    veut("production") ? prisma.siteHistoryEntry.findMany({ where: { site: { clientId }, ...(f.siteId && { siteId: f.siteId }), ...(dateWhere && { happenedAt: dateWhere }), ...(f.auteurId && { authorId: f.auteurId }) }, orderBy: { happenedAt: "desc" }, take: 100, include: { author: { select: { firstName: true, email: true } }, site: { select: { name: true } } } }) : [],
    veut("demande") ? prisma.changeRequest.findMany({ where: { site: { clientId }, ...(f.siteId && { siteId: f.siteId }), ...(dateWhere && { createdAt: dateWhere }) }, orderBy: { createdAt: "desc" }, take: 100, include: { site: { select: { name: true } } } }) : [],
    veut("tache") ? prisma.tacheClient.findMany({ where: { clientId, statut: "FAIT", ...(f.siteId && { siteId: f.siteId }), ...(dateWhere && { faitAt: dateWhere }), ...(f.auteurId && { responsableId: f.auteurId }) }, orderBy: { faitAt: "desc" }, take: 100, include: { responsable: { select: { firstName: true, email: true } } } }) : [],
    veut("parrainage") ? prisma.referral.findMany({ where: { referrerClientId: clientId, ...(dateWhere && { createdAt: dateWhere }) }, orderBy: { createdAt: "desc" }, take: 50 }) : [],
    veut("document") ? prisma.document.findMany({ where: { clientId, kind: { not: "FACTURE" }, ...(f.siteId && { siteId: f.siteId }), ...(dateWhere && { createdAt: dateWhere }) }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, title: true, kind: true, createdAt: true, siteId: true, uploadedByClient: true } }) : [],
    veut("contrat") ? prisma.contrat.findMany({ where: { clientId, ...(f.siteId && { siteId: f.siteId }) }, select: { id: true, reference: true, titre: true, statut: true, envoyeAt: true, signeAt: true, refuseAt: true, premierPaiementAt: true, impayeAt: true, regulariseAt: true, createdAt: true, siteId: true } }) : [],
  ]);

  const ev: Evenement[] = [];
  const vus = new Set<string>();
  for (const e of echanges) {
    const call = isAircallMeta(e.meta) ? e.meta : null, mail = isGmailMeta(e.meta) ? e.meta : null;
    // Doublon possible : même message Gmail remonté par deux boîtes (externalId gmail:<user>:<msgId>) → garde le premier.
    const cle = mail && e.externalId ? `gmail:${e.externalId.split(":").pop()}` : e.id;
    if (vus.has(cle)) continue; vus.add(cle);
    const canal: Canal = mail || e.type === "MAIL" ? "email" : call || e.type === "APPEL" || e.type === "NRP" ? "appel" : e.type === "RDV" || e.type === "PRISE_RDV" || e.type === "NO_SHOW" ? "rdv" : e.type === "NOTE" ? "note" : "compte_rendu";
    if (!veut(canal)) continue;
    const titre = mail ? `${mail.direction === "recu" ? "Mail reçu" : "Mail envoyé"}${mail.objet ? ` : ${mail.objet}` : ""}` : call ? `Appel ${call.direction === "inbound" ? "entrant" : "sortant"}${call.ligne ? ` · ${call.ligne}` : ""}` : ECHANGE[e.type].label;
    ev.push({ id: `e:${e.id}`, echangeId: e.id, date: e.date, canal, titre, texte: mail ? (mail.extrait || null) : e.notes, href: null, auteurId: e.auteurId, auteur: e.auteur ? teamName(e.auteur) : e.auteurNom, siteId: null, contact: contactPar(mail ? (mail.direction === "recu" ? mail.de : mail.a) : null, call?.numero ?? null), interne: e.type === "NOTE", meta: e.meta });
  }
  for (const r of rdvs) ev.push({ id: `r:${r.id}`, date: r.debut, canal: "rdv", titre: `${r.resultat === "PREVU" ? (r.debut > new Date() ? "RDV prévu" : "RDV") : r.resultat === "FAIT" ? "RDV tenu" : r.resultat === "NO_SHOW" ? "RDV manqué (absent)" : "RDV annulé"}${r.titre ? ` : ${r.titre}` : ""}`, texte: [r.lieu, r.site?.name].filter(Boolean).join(" · ") || null, href: r.meetUrl, auteurId: r.commercialId, auteur: r.commercial ? teamName(r.commercial) : null, siteId: r.siteId, contact: null, interne: false });
  for (const a of activites) {
    const canal: Canal = /^(contrat|paiement|impaye|conversion)$/.test(a.kind) ? "contrat" : /^(site_etape|site_statut|modification|article|intervention|validation|validation_client)$/.test(a.kind) ? "production" : a.kind === "campagne" ? "campagne" : a.kind === "delegation" || a.kind === "reattribution" ? "autre" : "autre";
    if (!veut(canal)) continue;
    ev.push({ id: `a:${a.id}`, date: a.createdAt, canal, titre: a.texte, texte: null, href: a.href, auteurId: a.userId, auteur: a.user ? teamName(a.user) : null, siteId: a.siteId, contact: null, interne: true });
  }
  for (const h of histo) ev.push({ id: `h:${h.id}`, date: h.happenedAt, canal: "production", titre: `${h.title} · ${h.site.name}`, texte: [h.description, ...h.items].filter(Boolean).join(" · ") || null, href: `/admin/sites/${h.siteId}`, auteurId: h.authorId, auteur: h.author ? teamName(h.author) : null, siteId: h.siteId, contact: null, interne: false });
  for (const d of demandes) ev.push({ id: `d:${d.id}`, date: d.createdAt, canal: "demande", titre: `Demande de modification : ${d.title} (${CHANGE_STATUS[d.status].label})`, texte: `${d.site.name}${d.urgency === "URGENTE" ? " · urgent" : ""}`, href: `/admin/modifications`, auteurId: null, auteur: null, siteId: d.siteId, contact: null, interne: false });
  for (const t of taches) ev.push({ id: `t:${t.id}`, date: t.faitAt ?? t.updatedAt, canal: "tache", titre: `Tâche faite : ${t.titre}`, texte: t.description, href: null, auteurId: t.responsableId, auteur: t.responsable ? teamName(t.responsable) : null, siteId: t.siteId, contact: null, interne: true });
  for (const r of referrals) ev.push({ id: `p:${r.id}`, date: r.createdAt, canal: "parrainage", titre: `Parrainage : ${r.contactName ?? "contact"}`, texte: r.note, href: "/admin/recommandations", auteurId: null, auteur: null, siteId: null, contact: null, interne: false });
  for (const d of docs) ev.push({ id: `doc:${d.id}`, date: d.createdAt, canal: "document", titre: `${d.uploadedByClient ? "Document déposé par le client" : "Document ajouté"} : ${d.title}`, texte: null, href: `/admin/clients/${clientId}/documents`, auteurId: null, auteur: null, siteId: d.siteId, contact: null, interne: false });
  for (const c of contrats) {
    const pousse = (date: Date | null, titre: string) => { if (date && (!depuis || date >= depuis)) ev.push({ id: `c:${c.id}:${titre}`, date, canal: "contrat", titre: `${c.reference} · ${titre}`, texte: c.titre, href: `/admin/contrats/${c.id}`, auteurId: null, auteur: null, siteId: c.siteId, contact: null, interne: false }); };
    pousse(c.createdAt, `contrat créé (${CONTRAT_STATUT[c.statut].label})`); pousse(c.envoyeAt, "contrat envoyé"); pousse(c.signeAt, "contrat accepté"); pousse(c.refuseAt, "contrat refusé");
    pousse(c.premierPaiementAt, "premier paiement reçu"); pousse(c.impayeAt, "impayé signalé"); pousse(c.regulariseAt, "impayé régularisé");
  }
  const filtre = ev.filter((x) => (!f.siteId || !x.siteId || x.siteId === f.siteId) && (!f.auteurId || !x.auteurId || x.auteurId === f.auteurId));
  filtre.sort((a, b) => b.date.getTime() - a.date.getTime());
  return filtre.slice(0, f.limite ?? 300);
}

/** Dernier contact réel (email, appel, RDV tenu, compte rendu) : la même règle que l'alerte 60 jours. */
export async function dernierContact(clientId: string) {
  const items = await timelineClient(clientId, { canaux: CANAUX_CONTACT, limite: 5 });
  return items.find((i) => i.date <= new Date())?.date ?? null;
}
