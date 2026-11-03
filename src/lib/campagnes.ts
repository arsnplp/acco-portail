/**
 * Envois groupés de petite taille (00.4, 8.4, 3.2) : un email individuel par destinataire via la boîte Gmail de l'auteur,
 * variables, aperçu, envoi test, validation humaine (validation CAMPAGNE), plafond par envoi (50 par défaut), étalement
 * (5 envois par minute), reprise en cas d'erreur, désinscription des messages commerciaux, journal, retours dans la timeline.
 */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { envoyerParGmail, remplacerVariables, type Variables } from "@/lib/gmail-send";
import { demanderValidation } from "@/lib/validations";
import { logActivite } from "@/lib/activite";
import { journal } from "@/lib/connecteurs";
import { appUrl } from "@/lib/email";

export const CAMPAGNE_STATUT = { BROUILLON: { label: "Brouillon", tone: "neutral" }, VALIDEE: { label: "Validée, prête à partir", tone: "blue" }, EN_COURS: { label: "Envoi en cours", tone: "yellow" }, TERMINEE: { label: "Terminée", tone: "green" }, ANNULEE: { label: "Annulée", tone: "pink" } } as const;
export const MODELES: Array<{ key: string; titre: string; objet: string; corps: string }> = [
  { key: "nouveautes", titre: "Nouveautés", objet: "Du nouveau chez ACCO LAB pour {{societe}}", corps: "<p>Bonjour {{prenom}},</p><p>Quelques nouveautés qui peuvent intéresser {{societe}} :</p><ul><li>…</li></ul><p>Je reste à votre disposition,<br>{{commercial}}</p>" },
  { key: "satisfaction", titre: "Satisfaction", objet: "Comment ça se passe avec votre site {{site}} ?", corps: "<p>Bonjour {{prenom}},</p><p>Un petit mot pour savoir comment se passe {{site}} et si nous pouvons améliorer quelque chose.</p><p>Répondez simplement à cet email.<br>{{commercial}}</p>" },
  { key: "parrainage", titre: "Parrainage", objet: "Vous connaissez quelqu’un qui a besoin d’un site ?", corps: "<p>Bonjour {{prenom}},</p><p>Si un commerçant ou artisan de votre entourage cherche un site, recommandez-le-nous depuis votre espace : vous êtes récompensé.</p><p>{{commercial}}</p>" },
  { key: "inactifs", titre: "Clients sans nouvelles", objet: "On prend des nouvelles de {{societe}}", corps: "<p>Bonjour {{prenom}},</p><p>Cela fait un moment que nous n’avons pas échangé. Souhaitez-vous faire un point sur {{site}} ?</p><p>{{commercial}}</p>" },
  { key: "libre", titre: "Campagne libre", objet: "", corps: "<p>Bonjour {{prenom}},</p><p></p><p>{{commercial}}</p>" },
];
export const VARIABLES = ["prenom", "nom", "societe", "site", "commercial", "offre"];

const SECRET = () => process.env.CRON_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "acco";
export const jetonDesinscription = (contactId: string) => createHash("sha256").update(`${contactId}:${SECRET()}`).digest("hex").slice(0, 24);
export const lienDesinscription = (contactId: string) => appUrl(`/desinscription?c=${contactId}&t=${jetonDesinscription(contactId)}`);

const echapper = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** Variables d'un destinataire (contact + client + premier site + référent), échappées pour le HTML. */
async function variablesPour(clientId: string, contactId: string | null): Promise<Variables> {
  const v = await variablesBrutes(clientId, contactId);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, echapper(String(x ?? ""))]));
}
async function variablesBrutes(clientId: string, contactId: string | null): Promise<Variables> {
  const [client, contact] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { name: true, commercial: { select: { firstName: true, lastName: true, email: true } }, sites: { orderBy: { createdAt: "asc" }, take: 1, select: { name: true } }, subscriptions: { where: { status: "ACTIF" }, take: 1, select: { label: true } } } }),
    contactId ? prisma.prospectContact.findUnique({ where: { id: contactId }, select: { prenom: true, nom: true } }) : null,
  ]);
  return { prenom: contact?.prenom ?? "", nom: contact?.nom ?? "", societe: client?.name ?? "", site: client?.sites[0]?.name ?? "", commercial: client?.commercial ? [client.commercial.firstName, client.commercial.lastName].filter(Boolean).join(" ") || client.commercial.email : "L’équipe ACCO LAB", offre: client?.subscriptions[0]?.label ?? "" };
}

/** Destinataires d'une liste de clients : un email par contact (principal d'abord), désinscrits exclus si message commercial, doublons retirés. */
export async function preparerDestinataires(campagneId: string, clientIds: string[]) {
  const c = await prisma.campagne.findUniqueOrThrow({ where: { id: campagneId } });
  const clients = await prisma.client.findMany({ where: { id: { in: clientIds }, archivedAt: null }, select: { id: true, email: true, contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }], select: { id: true, email: true, optOutCommercial: true } }, crmProspect: { select: { contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }], select: { id: true, email: true, optOutCommercial: true } } } } } });
  const vus = new Set<string>();
  const rows: { campagneId: string; clientId: string; contactId: string | null; email: string; statut: "EN_ATTENTE" | "EXCLU"; erreur: string | null }[] = [];
  for (const cl of clients) {
    const contacts = [...cl.contacts, ...(cl.crmProspect?.contacts ?? [])].filter((x) => x.email);
    const principal = contacts[0] ?? null;
    const email = principal?.email ?? cl.email;
    if (!email) { continue; }
    const e = email.trim().toLowerCase();
    if (vus.has(e)) continue; vus.add(e);
    const exclu = c.commercial && !!principal?.optOutCommercial;
    rows.push({ campagneId, clientId: cl.id, contactId: principal?.id ?? null, email: e, statut: exclu ? "EXCLU" : "EN_ATTENTE", erreur: exclu ? "Désinscrit des messages commerciaux" : null });
  }
  await prisma.campagneDestinataire.deleteMany({ where: { campagneId, statut: { in: ["EN_ATTENTE", "EXCLU"] } } });
  if (rows.length) await prisma.campagneDestinataire.createMany({ data: rows });
  return { total: rows.length, exclus: rows.filter((r) => r.statut === "EXCLU").length, sansEmail: clients.length - rows.length };
}

function corpsFinal(c: { corpsHtml: string; commercial: boolean }, vars: Variables, contactId: string | null) {
  const html = remplacerVariables(c.corpsHtml, vars);
  const pied = c.commercial ? `<p style="font-size:12px;color:#71717a;margin-top:24px">Vous ne souhaitez plus recevoir nos messages d’information ? ${contactId ? `<a href="${lienDesinscription(contactId)}">Se désinscrire</a> ou ` : ""}répondez « STOP » à cet email.</p>` : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#18181b;max-width:600px">${html}${pied}</div>`;
}

/** Aperçu rendu pour un destinataire donné (ou le premier). */
export async function apercu(campagneId: string, destinataireId?: string | null) {
  const c = await prisma.campagne.findUniqueOrThrow({ where: { id: campagneId } });
  const d = destinataireId ? await prisma.campagneDestinataire.findUnique({ where: { id: destinataireId } }) : await prisma.campagneDestinataire.findFirst({ where: { campagneId, statut: "EN_ATTENTE" } });
  const vars = d ? await variablesPour(d.clientId, d.contactId) : { prenom: "Marie", nom: "Dupont", societe: "Boulangerie Dupont", site: "boulangerie-dupont.fr", commercial: "Bilel", offre: "Site vitrine" };
  return { objet: remplacerVariables(c.objet, vars), html: corpsFinal(c, vars, d?.contactId ?? "exemple"), email: d?.email ?? null };
}

/** Envoi test à l'auteur (ou à l'adresse donnée) : jamais compté, jamais aux clients. */
export async function envoyerTest(campagneId: string, userId: string, to: string) {
  const a = await apercu(campagneId);
  return envoyerParGmail({ userId, to, subject: `[TEST] ${a.objet}`, html: a.html });
}

/** Validation humaine (00.4) avant tout envoi : droit campagnes (Bilel ou délégataire habilité). */
export async function demanderValidationCampagne(campagneId: string, userId: string) {
  const c = await prisma.campagne.findUniqueOrThrow({ where: { id: campagneId }, include: { _count: { select: { destinataires: { where: { statut: "EN_ATTENTE" } } } } } });
  if (c.statut !== "BROUILLON") return { error: "Cette campagne n’est plus un brouillon." };
  if (c._count.destinataires === 0) return { error: "Aucun destinataire." };
  if (c._count.destinataires > c.plafond) return { error: `${c._count.destinataires} destinataires pour un plafond de ${c.plafond} : réduisez la sélection ou augmentez le plafond.` };
  const n = await demanderValidation({ type: "CAMPAGNE", objetId: campagneId, demandeParId: userId, commentaire: `${c.titre} : ${c._count.destinataires} destinataire${c._count.destinataires > 1 ? "s" : ""}`, href: `/admin/campagnes/${campagneId}` });
  return { ok: true, creees: n };
}

/** Lancement (après validation) : la file est traitée par le ticker, 5 envois par minute. */
export async function lancerCampagne(campagneId: string, userId: string) {
  const c = await prisma.campagne.findUniqueOrThrow({ where: { id: campagneId } });
  if (c.statut !== "VALIDEE") return { error: "La campagne doit être validée par une personne habilitée avant l’envoi." };
  await prisma.campagne.update({ where: { id: campagneId }, data: { statut: "EN_COURS", envoiDebutAt: new Date() } });
  await logActivite({ kind: "campagne", texte: `Campagne « ${c.titre} » lancée`, href: `/admin/campagnes/${campagneId}`, userId });
  return { ok: true };
}

/** Traite la file : au plus `lot` envois par passage, par la boîte de l'auteur ; chaque envoi devient un échange sur la fiche client. */
export async function traiterCampagnes(lot = 5) {
  const g = globalThis as { __campagnesBusy?: boolean };
  if (g.__campagnesBusy) return { envoyes: 0, campagnes: 0 };
  g.__campagnesBusy = true;
  try { return await traiterCampagnesInterne(lot); } finally { g.__campagnesBusy = false; }
}
async function traiterCampagnesInterne(lot: number) {
  const enCours = await prisma.campagne.findMany({ where: { statut: "EN_COURS" }, include: { auteur: { select: { id: true, firstName: true, email: true } } } });
  let envoyes = 0;
  for (const c of enCours) {
    const attente = await prisma.campagneDestinataire.findMany({ where: { campagneId: c.id, statut: "EN_ATTENTE" }, take: Math.max(0, lot - envoyes), orderBy: { id: "asc" } });
    for (const d of attente) {
      const vars = await variablesPour(d.clientId, d.contactId);
      const r = await envoyerParGmail({ userId: c.auteurId, to: d.email, subject: remplacerVariables(c.objet, vars), html: corpsFinal(c, vars, d.contactId) });
      if (r.ok) {
        await prisma.campagneDestinataire.update({ where: { id: d.id }, data: { statut: "ENVOYE", gmailId: r.id, envoyeAt: new Date(), erreur: null } });
        const p = await prisma.prospect.findFirst({ where: { clientId: d.clientId }, select: { id: true } });
        await prisma.echange.create({ data: { clientId: d.clientId, prospectId: p?.id ?? null, type: "MAIL", origine: "campagne", externalId: `campagne:${d.id}`, auteurId: c.auteurId, notes: `Mail envoyé (campagne « ${c.titre} ») : ${remplacerVariables(c.objet, vars)}`, meta: { source: "gmail", messageId: r.id, threadId: "", direction: "envoye", objet: remplacerVariables(c.objet, vars), de: r.de, a: d.email, extrait: "", boite: r.de, campagneId: c.id } } }).catch(() => null);
        envoyes++;
      } else {
        await prisma.campagneDestinataire.update({ where: { id: d.id }, data: { statut: "ERREUR", erreur: r.error } });
        await journal("gmail", "erreur", `Campagne ${c.titre} → ${d.email} : ${r.error}`);
        if (/désactivé|Aucune boîte|expirée|Permission/i.test(r.error)) break; // inutile d'insister sur ce passage : reprise au prochain
      }
      if (envoyes >= lot) break;
    }
    const reste = await prisma.campagneDestinataire.count({ where: { campagneId: c.id, statut: "EN_ATTENTE" } });
    if (reste === 0) {
      await prisma.campagne.update({ where: { id: c.id }, data: { statut: "TERMINEE", envoiFinAt: new Date() } });
      await logActivite({ kind: "campagne", texte: `Campagne « ${c.titre} » terminée`, href: `/admin/campagnes/${c.id}`, userId: c.auteurId });
    }
    if (envoyes >= lot) break;
  }
  return { envoyes, campagnes: enCours.length };
}
/** Reprise des erreurs : remet en attente les destinataires en erreur (ex. boîte reconnectée). */
export async function reprendreErreurs(campagneId: string) {
  await prisma.campagneDestinataire.updateMany({ where: { campagneId, statut: "ERREUR" }, data: { statut: "EN_ATTENTE", erreur: null } });
  await prisma.campagne.updateMany({ where: { id: campagneId, statut: "TERMINEE" }, data: { statut: "EN_COURS", envoiFinAt: null } });
}
export function startCampagnesTicker() {
  const g = globalThis as { __campagnesTicker?: NodeJS.Timeout };
  if (g.__campagnesTicker) return;
  const tick = () => traiterCampagnes(5).catch((e) => console.warn("[campagnes]", (e as Error).message));
  setTimeout(tick, 60_000);
  g.__campagnesTicker = setInterval(tick, 60_000);
}
