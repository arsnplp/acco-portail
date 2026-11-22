/**
 * Contrats (sections 5 et 00.5) : un seul générateur, utilisable depuis Prospection (prospect) et Suivi (client existant).
 * PDF généré côté serveur (pdf-lib), envoi par Gmail avec lien sécurisé, acceptation en ligne (nom, case, code email),
 * empreinte SHA-256 du PDF exact, certificat de preuve, archivage immuable ; conversion idempotente prospect → client.
 */
import { createHash, randomInt } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Contrat, LigneContrat, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { signedUrl } from "@/lib/storage";
import { envoyerParGmail } from "@/lib/gmail-send";
import { appUrl, layout } from "@/lib/email";
import { logActivite } from "@/lib/activite";
import { FORMULE } from "@/lib/labels";
import { normName, normPhone } from "@/lib/crm";
import { ensureAuthUser, sendInvitationEmail } from "@/lib/invitations";
import { demanderValidation } from "@/lib/validations";
import { sendPushToUser } from "@/lib/push";

export const MOYEN_PAIEMENT_LABEL = { SEPA: "Prélèvement SEPA", CARTE: "Carte bancaire (lien Stripe)", VIREMENT: "Virement bancaire", LIEN: "Lien de paiement", AUTRE: "Autre" } as const;
export const CONTRAT_STATUT = {
  BROUILLON: { label: "Brouillon", tone: "neutral" }, ENVOYE: { label: "Envoyé", tone: "yellow" }, CONSULTE: { label: "Consulté", tone: "blue" },
  SIGNE: { label: "Signé", tone: "green" }, REFUSE: { label: "Refusé", tone: "pink" }, TERMINE: { label: "Terminé", tone: "neutral" },
} as const;
export const euros = (cents: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format(cents / 100);
const fmtDate = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" }).format(d) : "—");
export const sha256 = (b: Uint8Array | Buffer | string) => createHash("sha256").update(b).digest("hex");

export async function nouvelleReference(now = new Date()) {
  const annee = now.getFullYear();
  const derniers = await prisma.contrat.findMany({ where: { reference: { startsWith: `ACCO-${annee}-` } }, select: { reference: true } });
  const max = derniers.reduce((m, c) => Math.max(m, parseInt(c.reference.slice(`ACCO-${annee}-`.length), 10) || 0), 0);
  return `ACCO-${annee}-${String(max + 1).padStart(4, "0")}`;
}

export type ContratComplet = Contrat & { lignes: LigneContrat[]; client: { name: string; address: string | null; siren: string | null; email: string | null; formeJuridique?: string | null; siret?: string | null; rcsVille?: string | null; capitalEuros?: number | null; representantNom?: string | null; representantFonction?: string | null } | null; prospect: { societe: string; adresse: string | null; siren: string | null } | null; commercial: { firstName: string | null; lastName: string | null; email: string } | null; site: { name: string } | null };
export const chargerContrat = (id: string) => prisma.contrat.findUnique({ where: { id }, include: { lignes: { orderBy: { ordre: "asc" } }, client: { select: { name: true, address: true, siren: true, email: true, formeJuridique: true, siret: true, rcsVille: true, capitalEuros: true, representantNom: true, representantFonction: true } }, prospect: { select: { societe: true, adresse: true, siren: true } }, commercial: { select: { firstName: true, lastName: true, email: true } }, site: { select: { name: true } } } }) as Promise<ContratComplet | null>;

/** Contact principal (email) du client ou du prospect : destinataire du contrat. */
export async function signataireParDefaut(c: ContratComplet) {
  const where = c.clientId ? { clientId: c.clientId } : c.prospectId ? { prospectId: c.prospectId } : null;
  if (!where) return null;
  const contact = await prisma.prospectContact.findFirst({ where: { ...where, email: { not: null } }, orderBy: [{ principal: "desc" }, { createdAt: "asc" }] });
  if (contact?.email) return { nom: [contact.prenom, contact.nom].filter(Boolean).join(" "), email: contact.email };
  if (c.client?.email) return { nom: c.client.name, email: c.client.email };
  if (c.clientId) { const m = await prisma.clientMembership.findFirst({ where: { clientId: c.clientId }, orderBy: { createdAt: "asc" }, include: { user: true } }); if (m) return { nom: [m.user.firstName, m.user.lastName].filter(Boolean).join(" "), email: m.user.email }; }
  return null;
}

// ─── PDF ─────────────────────────────────────────────────────
function wrap(font: PDFFont, text: string, size: number, width: number) {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const essai = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(essai, size) > width && line) { out.push(line); line = word; } else line = essai;
    }
    out.push(line);
  }
  return out;
}
/** Caractères hors WinAnsi (emoji, guillemets rares) remplacés : pdf-lib n'embarque que les polices standard. */
const ascii = (s: string) => s.replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"').replace(/…/g, "...").replace(/€/g, "EUR").replace(/[\u202f\u00a0]/g, " ").replace(/[^\x00-\xFF]/g, "?");

export function clausesParDefaut(c: Contrat) {
  return [
    ["Objet", `ACCO LAB fournit au Client les prestations listees ci-dessus (creation, hebergement, maintenance, accompagnement) selon la formule ${c.formule ? FORMULE[c.formule].label : "convenue"}.`],
    ["Duree et reconduction", `Engagement de ${c.dureeMois} mois a compter du ${fmtDate(c.debutEngagement)}${c.finEngagement ? ` jusqu'au ${fmtDate(c.finEngagement)}` : ""}, reconduit tacitement par periodes de ${c.reconductionMois} mois. Le non-renouvellement est notifie par lettre recommandee avec un preavis de ${c.preavisJours} jours avant l'echeance.`],
    ["Prix et paiement", `Abonnement mensuel de ${euros(c.montantMensuelHt)} HT${c.montantPonctuelHt ? ` et prestations ponctuelles de ${euros(c.montantPonctuelHt)} HT` : ""}, TVA en sus au taux en vigueur. Moyen de paiement : ${c.moyenPaiement ? MOYEN_PAIEMENT_LABEL[c.moyenPaiement] : "a convenir"}. La premiere mensualite est due a la signature ; la production demarre a reception du premier reglement.`],
    ["Evolutions", "Toute evolution de la formule fait l'objet d'un avenant signe, applicable a la prochaine echeance mensuelle. Aucune diminution de formule pendant la periode d'engagement."],
    ["Acceptation", "Le Client accepte le present contrat par signature manuscrite ou par acceptation en ligne (identification par email et code a usage unique), qui vaut signature. L'empreinte numerique du document accepte est conservee avec le certificat de preuve."],
  ];
}

export { INFOS_CLIENT_CHAMPS, type InfosClient } from "@/lib/contrat-infos";
import { INFOS_CLIENT_CHAMPS, type InfosClient } from "@/lib/contrat-infos";
import { articlesContrat, type ChoixContrat } from "@/lib/contrat-articles";
/** Infos du contrat : ce qui a été saisi dans le générateur, sinon la fiche client / prospect. */
export function infosClientDe(c: ContratComplet & { client?: (ContratComplet["client"] & Partial<{ formeJuridique: string | null; siret: string | null; rcsVille: string | null; capitalEuros: number | null; representantNom: string | null; representantFonction: string | null }>) | null }): InfosClient {
  const saisi = ((c.contenu as { client?: Partial<InfosClient> } | null)?.client ?? {}) as Partial<InfosClient>;
  const cl = c.client;
  const base: InfosClient = {
    nom: cl?.name ?? c.prospect?.societe ?? "", forme: cl?.formeJuridique ?? "", adresse: cl?.address ?? c.prospect?.adresse ?? "", siret: cl?.siret ?? cl?.siren ?? c.prospect?.siren ?? "",
    rcs: cl?.rcsVille ?? "", capital: cl?.capitalEuros ? String(cl.capitalEuros) : "", representant: cl?.representantNom ?? c.signataireNom ?? "", fonction: cl?.representantFonction ?? "", email: cl?.email ?? c.signataireEmail ?? "",
  };
  for (const k of Object.keys(base) as (keyof InfosClient)[]) if (saisi[k]?.trim()) base[k] = saisi[k]!.trim();
  return base;
}
export const infosManquantes = (i: InfosClient) => INFOS_CLIENT_CHAMPS.filter((f) => f.requis && !i[f.key].trim()).map((f) => f.label);

/** Construit le PDF du contrat (octets) : page de garde, parties, prestations, articles du modèle, signatures. */
export async function construirePdf(c: ContratComplet) {
  const { reglagesContrat, rendreModele, articlesDuModele } = await import("@/lib/contrat-modele");
  const { modele, agence } = await reglagesContrat();
  const infos = infosClientDe(c);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, marge = 56, largeur = W - 2 * marge;
  const noir = rgb(0.08, 0.08, 0.1), gris = rgb(0.45, 0.45, 0.5);
  const clean = (t: string) => ascii(t.replace(/œ/g, "oe").replace(/Œ/g, "OE"));

  // ── Page de garde ──
  let page: PDFPage = pdf.addPage([W, H]), y = H - marge;
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(0.97, 0.97, 0.98) });
  page.drawText(clean(agence.nom.toLowerCase()), { x: marge, y: H - 90, size: 30, font: bold, color: noir });
  const annee = String((c.signeAt ?? c.debutEngagement ?? new Date()).getFullYear());
  page.drawText(annee, { x: marge, y: H / 2 + 40, size: 150, font: bold, color: rgb(0.9, 0.9, 0.92) });
  page.drawText("Contrat de prestation", { x: marge, y: H / 2 - 10, size: 34, font: bold, color: noir });
  page.drawText(clean("de services digitaux"), { x: marge, y: H / 2 - 48, size: 22, font, color: gris });
  const sousTitre = [...new Set(c.lignes.map((l) => l.libelle.split(":")[0].trim()))].join(" · ").toUpperCase();
  for (const l of wrap(font, clean(sousTitre), 10, largeur).slice(0, 2)) { page.drawText(l, { x: marge, y: H / 2 - 80 - (sousTitre ? 0 : 0), size: 10, font, color: gris }); }
  page.drawText(clean(`${infos.nom || "Client"}`), { x: marge, y: 200, size: 16, font: bold, color: noir });
  page.drawText(clean(`${c.reference}${c.version > 1 ? ` - avenant n°${c.version - 1}` : ""} · ${fmtDate(new Date())}`), { x: marge, y: 178, size: 10, font, color: gris });
  page.drawRectangle({ x: marge, y: 120, width: largeur, height: 2, color: noir });
  page.drawText(clean(`${agence.nom} · ${agence.adresse} · SIRET ${agence.siret}`), { x: marge, y: 100, size: 9, font, color: gris });

  // ── Pages de texte ──
  const nouvellePage = () => { page = pdf.addPage([W, H]); y = H - marge; };
  const texte = (t: string, size = 10, f: PDFFont = font, gap = 4, color = noir) => {
    for (const l of wrap(f, clean(t), size, largeur)) { if (y < marge + 40) nouvellePage(); page.drawText(l, { x: marge, y, size, font: f, color }); y -= size + gap; }
  };
  const titre = (t: string) => { if (y < marge + 80) nouvellePage(); y -= 10; texte(t, 12, bold, 6); };
  nouvellePage();
  texte("CONTRAT DE PRESTATION DE SERVICES DIGITAUX", 15, bold, 4);
  texte(sousTitre || "CRÉATION WEB, HÉBERGEMENT & ACCOMPAGNEMENT", 8.5, bold, 14, gris);
  texte(`${agence.nom}${agence.forme ? ` (${agence.forme})` : ""}, situé au ${agence.adresse}, immatriculé sous le numéro ${agence.siret}${agence.representant ? `, représenté par ${agence.representant}` : ""}, ci-après dénommé « le Prestataire ».`, 10, font, 8);
  texte("ET :", 10, bold, 8);
  const capital = infos.capital ? `, au capital de ${Number(infos.capital).toLocaleString("fr-FR")} €` : "";
  texte(`${infos.nom}${infos.forme ? ` (${infos.forme})` : ""}${capital}, situé au ${infos.adresse || "—"}, immatriculé sous le numéro ${infos.siret || "—"}${infos.rcs ? ` (RCS ${infos.rcs})` : ""}${infos.representant ? `, représenté par ${infos.representant}${infos.fonction ? ` en qualité de ${infos.fonction}` : ""}` : ""}, ci-après dénommé « le Client ».`, 10, font, 10);
  texte("Il a été convenu ce qui suit.", 10, font, 8);

  const choix = (c.contenu as { choix?: ChoixContrat } | null)?.choix ?? null;
  if (choix) {
    // Contrat créé par l'assistant : articles 1 à 3 (prestations, création, conditions financières) d'après les choix.
    for (const [t, corps] of articlesContrat(choix)) { titre(t); texte(corps, 10, font, 4); }
  } else {
    titre("Prestations");
    for (const l of c.lignes) texte(`- ${l.libelle}${l.quantite > 1 ? ` x${l.quantite}` : ""} : ${euros(l.montantHt * l.quantite)} HT${l.billing === "MENSUEL" ? " / mois" : " (ponctuel)"}`);
    texte(`Total mensuel : ${euros(c.montantMensuelHt)} HT${c.montantPonctuelHt ? ` · Ponctuel : ${euros(c.montantPonctuelHt)} HT` : ""}`, 10, bold);
  }
  if (c.site) texte(`Site concerné : ${c.site.name}.`, 10, font);

  const vars: Record<string, string> = {
    "client.nom": infos.nom, "client.forme": infos.forme, "client.adresse": infos.adresse, "client.siret": infos.siret, "client.representant": infos.representant, "client.fonction": infos.fonction, "client.email": infos.email,
    "agence.nom": agence.nom, "agence.adresse": agence.adresse, "agence.siret": agence.siret,
    prestations: c.lignes.map((l) => l.libelle).join(", "), mensuel: euros(c.montantMensuelHt), ponctuel: euros(c.montantPonctuelHt), formule: c.formule ? FORMULE[c.formule].label : "convenue",
    duree: String(c.dureeMois), reconduction: String(c.reconductionMois), preavis: String(c.preavisJours), debut: c.debutEngagement ? fmtDate(c.debutEngagement) : "la signature", fin: c.finEngagement ? fmtDate(c.finEngagement) : "",
    fin_phrase: c.finEngagement ? ` jusqu'au ${fmtDate(c.finEngagement)}` : "", ponctuel_phrase: c.montantPonctuelHt ? ` et des prestations ponctuelles de ${euros(c.montantPonctuelHt)} HT` : "",
    paiement: c.moyenPaiement ? MOYEN_PAIEMENT_LABEL[c.moyenPaiement] : "à convenir", commercial: c.commercial ? [c.commercial.firstName, c.commercial.lastName].filter(Boolean).join(" ") : agence.nom, date: fmtDate(new Date()), reference: c.reference,
  };
  // Clauses figées sur le contrat (générées une première fois) sinon le modèle courant.
  const figees = (c.contenu as { clauses?: [string, string][] } | null)?.clauses;
  const articles = figees && figees.length ? figees : articlesDuModele(rendreModele(modele, vars));
  for (const [t, corps] of articles) { if (t) titre(t); texte(corps, 10, font, 4); }

  titre("Signatures");
  texte(`Fait en deux exemplaires, le ${fmtDate(new Date())}.`, 10, font, 10);
  if (y < marge + 120) nouvellePage();
  const col = largeur / 2 - 10;
  page.drawText(clean(`Pour ${agence.nom}`), { x: marge, y, size: 10, font: bold, color: noir });
  page.drawText("Pour le Client", { x: marge + col + 20, y, size: 10, font: bold, color: noir }); y -= 14;
  page.drawText(clean(agence.representant || c.commercial ? `${agence.representant || [c.commercial?.firstName, c.commercial?.lastName].filter(Boolean).join(" ")}` : ""), { x: marge, y, size: 9, font, color: gris });
  page.drawText(clean(`${infos.representant}${infos.fonction ? `, ${infos.fonction}` : ""}`), { x: marge + col + 20, y, size: 9, font, color: gris }); y -= 70;
  page.drawRectangle({ x: marge, y, width: col, height: 0.8, color: gris });
  page.drawRectangle({ x: marge + col + 20, y, width: col, height: 0.8, color: gris }); y -= 12;
  page.drawText(clean('Signature précédée de « Lu et approuvé »'), { x: marge, y, size: 8, font, color: gris });
  page.drawText(clean('Signature précédée de « Lu et approuvé »'), { x: marge + col + 20, y, size: 8, font, color: gris });

  // Pied de page numéroté.
  const pages = pdf.getPages();
  pages.forEach((pg, i) => { if (i === 0) return; pg.drawText(clean(`${c.reference} · ${agence.nom} · page ${i} / ${pages.length - 1}`), { x: marge, y: 30, size: 8, font, color: gris }); });
  return pdf.save();
}

/** Génère (ou régénère tant qu'il est brouillon) le PDF, le dépose et enregistre son empreinte. */
export async function genererPdf(contratId: string) {
  const c = await chargerContrat(contratId);
  if (!c) throw new Error("Contrat introuvable.");
  if (c.statut === "SIGNE") throw new Error("Un contrat signé est immuable : créez un avenant.");
  const bytes = await construirePdf(c);
  const path = `contrats/${c.id}/${c.reference}-v${c.version}-${Date.now()}.pdf`;
  const { error } = await createSupabaseAdmin().storage.from("documents").upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: false });
  if (error) throw new Error(error.message);
  const hash = sha256(bytes);
  await prisma.contrat.update({ where: { id: c.id }, data: { pdfPath: path, pdfSha256: hash } });
  return { path, hash };
}
export const lienPdf = (path: string | null) => (path ? signedUrl("documents", path, 3600) : Promise.resolve(null));

// ─── Envoi, consultation, code, acceptation ──────────────────
export async function envoyerContrat(contratId: string, userId: string, destinataire?: { nom: string; email: string } | null) {
  const c = await chargerContrat(contratId);
  if (!c) return { ok: false as const, error: "Contrat introuvable." };
  if (c.statut === "SIGNE" || c.statut === "REFUSE") return { ok: false as const, error: "Ce contrat est déjà clos." };
  if (!c.pdfPath) await genererPdf(contratId);
  const dest = destinataire ?? (await signataireParDefaut(c));
  if (!dest?.email) return { ok: false as const, error: "Aucune adresse email de contact : ajoutez un contact avec email." };
  const lien = appUrl(`/contrat/${c.token}`);
  const societe = c.client?.name ?? c.prospect?.societe ?? "";
  const html = layout(`Votre contrat ${c.reference}`, `<p>Bonjour ${dest.nom || ""},</p><p>Voici votre contrat avec ACCO LAB pour ${societe}. Vous pouvez le lire et l'accepter en ligne en quelques clics ; un code vous sera envoyé par email pour confirmer.</p><p style="font-size:13px;color:#71717a">Lien personnel, ne le transmettez pas.</p>`, { label: "Lire et accepter le contrat", href: lien });
  const envoi = await envoyerParGmail({ userId: c.commercialId ?? userId, to: dest.email, subject: `Votre contrat ACCO LAB ${c.reference}`, html });
  if (!envoi.ok) return { ok: false as const, error: envoi.error };
  await prisma.contrat.update({ where: { id: c.id }, data: { statut: c.statut === "BROUILLON" ? "ENVOYE" : c.statut, envoyeAt: new Date(), signataireEmail: dest.email, signataireNom: c.signataireNom ?? dest.nom } });
  await logActivite({ kind: "contrat", texte: `Contrat ${c.reference} envoyé à ${dest.email}`, href: `/admin/contrats/${c.id}`, userId, clientId: c.clientId, siteId: c.siteId });
  return { ok: true as const, email: dest.email };
}

export async function marquerConsulte(token: string, ip: string | null, ua: string | null) {
  const c = await prisma.contrat.findUnique({ where: { token } });
  if (!c) return null;
  if (c.statut === "ENVOYE") await prisma.contrat.update({ where: { id: c.id }, data: { statut: "CONSULTE", consulteAt: new Date(), signataireIp: ip, signataireUa: ua } });
  return c;
}

const otpHash = (code: string, token: string) => sha256(`${code}:${token}:${process.env.CRON_SECRET ?? "acco"}`);
/** Envoie un code à usage unique (6 chiffres, 15 minutes) à l'adresse du signataire. */
export async function envoyerCode(token: string, email: string) {
  const c = await chargerContrat((await prisma.contrat.findUnique({ where: { token }, select: { id: true } }))?.id ?? "");
  if (!c || !["ENVOYE", "CONSULTE"].includes(c.statut)) return { ok: false as const, error: "Ce contrat n'est plus ouvert à l'acceptation." };
  const attendu = c.signataireEmail?.toLowerCase();
  if (attendu && attendu !== email.trim().toLowerCase()) return { ok: false as const, error: "Cette adresse ne correspond pas au destinataire du contrat." };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.contrat.update({ where: { id: c.id }, data: { otpHash: otpHash(code, token), otpExpiresAt: new Date(Date.now() + 15 * 60_000), signataireEmail: email.trim().toLowerCase() } });
  const html = layout("Votre code de confirmation", `<p>Pour accepter le contrat ${c.reference}, saisissez ce code dans les 15 minutes :</p><p style="font-size:28px;font-weight:800;letter-spacing:6px">${code}</p><p style="font-size:13px;color:#71717a">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`);
  const envoi = await envoyerParGmail({ userId: c.commercialId, to: email, subject: `Code de confirmation ${code} - contrat ${c.reference}`, html });
  if (!envoi.ok) return { ok: false as const, error: envoi.error };
  return { ok: true as const };
}

/** Acceptation en ligne : nom, case cochée, code vérifié ; empreinte et certificat archivés ; puis conversion. */
export async function accepterContrat(token: string, d: { nom: string; email: string; code: string; accepte: boolean; ip: string | null; ua: string | null }) {
  const c = await prisma.contrat.findUnique({ where: { token } });
  if (!c || !["ENVOYE", "CONSULTE"].includes(c.statut)) return { ok: false as const, error: "Ce contrat n'est plus ouvert à l'acceptation." };
  if (!d.accepte) return { ok: false as const, error: "Cochez « J'ai lu et j'accepte »." };
  if (!d.nom.trim()) return { ok: false as const, error: "Indiquez votre nom." };
  if (!c.otpHash || !c.otpExpiresAt || c.otpExpiresAt < new Date()) return { ok: false as const, error: "Code expiré : demandez-en un nouveau." };
  if (c.signataireEmail && c.signataireEmail !== d.email.trim().toLowerCase()) return { ok: false as const, error: "L’adresse ne correspond pas à celle qui a reçu le code." };
  if (otpHash(d.code.trim(), token) !== c.otpHash) {
    // 5 essais au plus par code : au-delà, le code est invalidé (il faut en redemander un).
    const essais = Number((c.contenu as { otpEssais?: number } | null)?.otpEssais ?? 0) + 1;
    await prisma.contrat.update({ where: { id: c.id }, data: essais >= 5 ? { otpHash: null, otpExpiresAt: null, contenu: { ...((c.contenu as object) ?? {}), otpEssais: 0 } as Prisma.InputJsonValue } : { contenu: { ...((c.contenu as object) ?? {}), otpEssais: essais } as Prisma.InputJsonValue } });
    return { ok: false as const, error: essais >= 5 ? "Trop d’essais : demandez un nouveau code." : "Code incorrect." };
  }
  if (!c.pdfPath || !c.pdfSha256) return { ok: false as const, error: "PDF du contrat absent." };
  // Empreinte du PDF exact accepté : on relit le fichier déposé et on la recalcule.
  const { data } = await createSupabaseAdmin().storage.from("documents").download(c.pdfPath);
  const octets = data ? new Uint8Array(await data.arrayBuffer()) : null;
  const empreinte = octets ? sha256(octets) : c.pdfSha256;
  if (empreinte !== c.pdfSha256) return { ok: false as const, error: "Le document a changé depuis son envoi ; contactez votre interlocuteur." };
  const signeAt = new Date();
  const certificat = await certificatPdf({ ...c, signeAt, signataireNom: d.nom.trim(), signataireEmail: d.email.trim().toLowerCase(), signataireIp: d.ip, signataireUa: d.ua });
  const certPath = `contrats/${c.id}/${c.reference}-certificat.pdf`;
  await createSupabaseAdmin().storage.from("documents").upload(certPath, Buffer.from(certificat), { contentType: "application/pdf", upsert: true });
  await prisma.contrat.update({ where: { id: c.id }, data: { statut: "SIGNE", signeAt, signataireNom: d.nom.trim(), signataireEmail: d.email.trim().toLowerCase(), signataireIp: d.ip, signataireUa: d.ua, certificatPath: certPath, otpHash: null, otpExpiresAt: null } });
  const conv = await convertirEnClient(c.id);
  await logActivite({ kind: "contrat", texte: `Contrat ${c.reference} signé en ligne par ${d.nom.trim()}`, href: `/admin/contrats/${c.id}`, clientId: conv.clientId, siteId: c.siteId });
  if (c.commercialId) await sendPushToUser(c.commercialId, { title: `Contrat ${c.reference} signé`, body: d.nom.trim(), url: `/admin/contrats/${c.id}`, tag: `contrat-${c.id}` }).catch(() => null);
  return { ok: true as const, clientId: conv.clientId };
}

export async function refuserContrat(token: string, motif: string | null) {
  const c = await prisma.contrat.findUnique({ where: { token } });
  if (!c || !["ENVOYE", "CONSULTE"].includes(c.statut)) return false;
  await prisma.contrat.update({ where: { id: c.id }, data: { statut: "REFUSE", refuseAt: new Date(), refusMotif: motif } });
  await logActivite({ kind: "contrat", texte: `Contrat ${c.reference} refusé${motif ? ` : ${motif}` : ""}`, href: `/admin/contrats/${c.id}`, clientId: c.clientId });
  return true;
}

/** Certificat de preuve : horodatage, identité vérifiée, IP, navigateur, empreinte SHA-256 du PDF. */
async function certificatPdf(c: Contrat & { signeAt: Date }) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]);
  let y = 780;
  const ligne = (t: string, f = font, size = 10) => { for (const l of wrap(f, ascii(t), size, 480)) { page.drawText(l, { x: 56, y, size, font: f }); y -= size + 5; } };
  ligne("ACCO LAB - Certificat de preuve d'acceptation en ligne", bold, 14); y -= 8;
  ligne(`Contrat : ${c.reference} (version ${c.version})`, bold);
  ligne(`Accepte le : ${new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "medium" }).format(c.signeAt)} (heure de Paris)`);
  ligne(`Signataire : ${c.signataireNom ?? ""} - email verifie : ${c.signataireEmail ?? ""} (code a usage unique recu par email)`);
  ligne(`Adresse IP : ${c.signataireIp ?? "inconnue"}`);
  ligne(`Navigateur : ${c.signataireUa ?? "inconnu"}`);
  ligne(`Empreinte SHA-256 du PDF accepte : ${c.pdfSha256 ?? ""}`);
  y -= 10;
  ligne("Le signataire a lu le document, a coche la mention << J'ai lu et j'accepte >>, puis a confirme avec le code recu a l'adresse ci-dessus. Le PDF et ce certificat sont archives sans modification possible ; toute modification ulterieure fait l'objet d'un avenant.");
  return pdf.save();
}

// ─── Conversion prospect → client (idempotente) ─────────────
/** Après signature : une seule fiche client, historique conservé, référent = commercial du contrat, portail activé, brief ouvert. */
export async function convertirEnClient(contratId: string): Promise<{ clientId: string; cree: boolean; siteId: string | null }> {
  const c = await prisma.contrat.findUnique({ where: { id: contratId }, include: { lignes: true, prospect: { include: { contacts: true } } } });
  if (!c) throw new Error("Contrat introuvable.");
  let clientId = c.clientId ?? c.prospect?.clientId ?? null;
  let cree = false;
  if (!clientId && c.prospect) {
    // Rapprochement contrôlé : même SIREN, même téléphone ou même nom normalisé → on rattache, on ne duplique pas.
    const p = c.prospect;
    const candidats = await prisma.client.findMany({ select: { id: true, name: true, siren: true, phone: true } });
    const existant = candidats.find((x) => (p.siren && x.siren && x.siren.replace(/\s/g, "") === p.siren.replace(/\s/g, "")) || (p.telephone && normPhone(x.phone) === normPhone(p.telephone)) || normName(x.name) === normName(p.societe));
    if (existant) clientId = existant.id;
    else {
      const principal = p.contacts.find((x) => x.principal) ?? p.contacts[0];
      const client = await prisma.client.create({ data: { name: p.societe, siren: p.siren, address: p.adresse, phone: p.telephone, email: principal?.email ?? null, commercialId: c.commercialId, formule: c.formule, engagementDebut: c.debutEngagement, engagementFin: c.finEngagement, conversation: { create: {} } } });
      clientId = client.id; cree = true;
    }
  }
  if (!clientId) throw new Error("Contrat sans client ni prospect.");
  await prisma.$transaction(async (tx) => {
    await tx.contrat.update({ where: { id: contratId }, data: { clientId } });
    if (c.prospect) {
      await tx.prospect.update({ where: { id: c.prospect.id }, data: { clientId, statut: "GAGNE", gagneAt: c.prospect.gagneAt ?? new Date(), mensuelEuros: Math.round(c.montantMensuelHt / 100), fraisCreationEuros: Math.round(c.montantPonctuelHt / 100) } });
      await tx.prospectContact.updateMany({ where: { prospectId: c.prospect.id, clientId: null }, data: { clientId } });
    }
    const client = await tx.client.findUniqueOrThrow({ where: { id: clientId } });
    if (!client.commercialId && c.commercialId) await tx.client.update({ where: { id: clientId }, data: { commercialId: c.commercialId } });
    if (!client.formule && c.formule) await tx.client.update({ where: { id: clientId }, data: { formule: c.formule, engagementDebut: c.debutEngagement, engagementFin: c.finEngagement } });
    // Lignes de service → abonnements (une fois : idempotent par contratId).
    const deja = await tx.subscription.count({ where: { contratId } });
    if (!deja) for (const l of c.lignes) {
      await tx.subscription.create({ data: { clientId, siteId: l.siteId ?? c.siteId, offerId: l.offerId, label: l.libelle, billing: l.billing, priceCents: l.montantHt * l.quantite, status: "ACTIF", startedAt: c.debutEngagement ?? new Date(), commitmentEndsAt: c.finEngagement, contratId, module: l.offerId ? (await tx.offer.findUnique({ where: { id: l.offerId }, select: { module: true } }))?.module ?? "NONE" : "NONE" } });
    }
  });
  // Site de référence : celui du contrat, sinon le premier du client, sinon un nouveau site en création (avec brief ouvert).
  let siteId = c.siteId ?? (await prisma.site.findFirst({ where: { clientId }, orderBy: { createdAt: "asc" }, select: { id: true } }))?.id ?? null;
  if (!siteId && c.lignes.length) {
    const nom = (await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } }))?.name ?? "Site";
    siteId = (await prisma.site.create({ data: { clientId, name: nom, contratId, developpeurId: null, assets: { create: [{ kind: "LOGO", label: "Votre logo" }, { kind: "TEXTE", label: "Textes de présentation" }, { kind: "PHOTO", label: "Photos" }] } }, select: { id: true } })).id;
  }
  if (siteId) {
    await prisma.site.updateMany({ where: { id: siteId, contratId: null }, data: { contratId } });
    await prisma.brief.upsert({ where: { siteId }, create: { siteId, etat: "EN_COURS" }, update: {} });
    await prisma.subscription.updateMany({ where: { contratId, siteId: null }, data: { siteId } });
  }
  // Portail : compte du contact principal (sans email Supabase automatique), invitation envoyée (transactionnel).
  const principal = await prisma.prospectContact.findFirst({ where: { clientId, email: { not: null } }, orderBy: [{ principal: "desc" }, { createdAt: "asc" }] });
  const membres = await prisma.clientMembership.count({ where: { clientId } });
  if (principal?.email && membres === 0) {
    try {
      const userId = await ensureAuthUser(principal.email.toLowerCase(), { first_name: principal.prenom ?? undefined, last_name: principal.nom ?? undefined });
      await prisma.user.upsert({ where: { id: userId }, create: { id: userId, email: principal.email.toLowerCase(), firstName: principal.prenom, lastName: principal.nom, role: "CLIENT" }, update: {} });
      await prisma.clientMembership.create({ data: { clientId, userId, role: "OWNER" } });
      const nom = (await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } }))?.name ?? "";
      await sendInvitationEmail({ email: principal.email.toLowerCase(), firstName: principal.prenom, clientName: nom, clientId, inviterId: c.commercialId });
    } catch (e) { console.warn("[conversion] portail", (e as Error).message); }
  }
  // Tâche commerciale : compléter le brief ; validation attendue plus tard (brief commercial puis technique).
  if (siteId) await prisma.tacheClient.create({ data: { clientId, siteId, contratId, type: "DOCUMENT", titre: "Compléter le brief avec le client", echeance: new Date(Date.now() + 7 * 86400_000), responsableId: c.commercialId, source: "signature" } });
  await logActivite({ kind: "conversion", texte: cree ? "Nouveau client créé à la signature" : "Contrat rattaché à la fiche client existante", href: `/admin/clients/${clientId}`, clientId, siteId, userId: c.commercialId });
  return { clientId, cree, siteId };
}

// ─── Paiement, impayé, avenant ───────────────────────────────
export async function premierPaiementRecu(contratId: string, userId: string, annuler = false) {
  const c = await prisma.contrat.update({ where: { id: contratId }, data: annuler ? { premierPaiementAnnuleAt: new Date(), premierPaiementAt: null, premierPaiementParId: null } : { premierPaiementAt: new Date(), premierPaiementParId: userId, premierPaiementAnnuleAt: null } });
  await logActivite({ kind: "paiement", texte: annuler ? `Premier paiement annulé pour ${c.reference}` : `Premier paiement reçu pour ${c.reference} : la production peut démarrer`, href: `/admin/contrats/${c.id}`, userId, clientId: c.clientId, siteId: c.siteId });
  return c;
}
export async function signalerImpaye(contratId: string, userId: string, regularise = false) {
  const c = await prisma.contrat.update({ where: { id: contratId }, data: regularise ? { regulariseAt: new Date(), impayeAt: null, impayeParId: null } : { impayeAt: new Date(), impayeParId: userId, regulariseAt: null }, include: { client: { select: { name: true, commercialId: true } } } });
  await logActivite({ kind: "impaye", texte: regularise ? `${c.client?.name ?? c.reference} : impayé régularisé` : `${c.client?.name ?? c.reference} : impayé signalé (contrat ${c.reference} en retard)`, href: `/admin/contrats/${c.id}`, userId, clientId: c.clientId });
  if (!regularise) {
    // Alertes internes seulement (aucun email au client) : référent + Direction.
    const direction = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    for (const id of new Set([c.client?.commercialId, ...direction.map((u) => u.id)].filter((x): x is string => !!x))) await sendPushToUser(id, { title: `Impayé : ${c.client?.name ?? c.reference}`, body: `Contrat ${c.reference} en retard`, url: `/admin/contrats/${c.id}`, tag: `impaye-${c.id}` }).catch(() => null);
  }
  return c;
}
/** Avenant : copie du contrat signé en nouvelle version brouillon, l'original reste intact. */
export async function creerAvenant(parentId: string, userId: string) {
  const p = await prisma.contrat.findUnique({ where: { id: parentId }, include: { lignes: true } });
  if (!p || p.statut !== "SIGNE") throw new Error("Seul un contrat signé peut recevoir un avenant.");
  const derniere = await prisma.contrat.aggregate({ where: { OR: [{ id: parentId }, { parentId }] }, _max: { version: true } });
  const a = await prisma.contrat.create({ data: {
    reference: `${p.reference.replace(/-A\d+$/, "")}-A${(derniere._max.version ?? 1)}`, clientId: p.clientId, prospectId: p.prospectId, siteId: p.siteId, parentId, version: (derniere._max.version ?? 1) + 1,
    titre: `Avenant : ${p.titre}`, formule: p.formule, montantMensuelHt: p.montantMensuelHt, montantPonctuelHt: 0, moyenPaiement: p.moyenPaiement, dureeMois: p.dureeMois, reconductionMois: p.reconductionMois, preavisJours: p.preavisJours,
    debutEngagement: p.debutEngagement, finEngagement: p.finEngagement, commercialId: p.commercialId, createdById: userId,
    lignes: { create: p.lignes.map((l) => ({ offerId: l.offerId, siteId: l.siteId, libelle: l.libelle, billing: l.billing, montantHt: l.montantHt, quantite: l.quantite, ordre: l.ordre })) },
  } });
  await logActivite({ kind: "contrat", texte: `Avenant ${a.reference} créé (brouillon)`, href: `/admin/contrats/${a.id}`, userId, clientId: p.clientId });
  return a;
}
/** Demande de dérogation « démarrer sans premier paiement » : exception commerciale (Bilel ou Lucas) puis accord technique (Arsène). */
export async function demanderDerogationPaiement(contratId: string, userId: string, motif: string) {
  const c = await prisma.contrat.findUnique({ where: { id: contratId }, select: { clientId: true, siteId: true, reference: true } });
  if (!c) return 0;
  return demanderValidation({ type: "DEROGATION_PAIEMENT_COMMERCIALE", contratId, clientId: c.clientId, siteId: c.siteId, demandeParId: userId, commentaire: `${c.reference} : ${motif}`, href: `/admin/contrats/${contratId}` });
}
/** La production peut-elle démarrer ? Premier paiement reçu, ou dérogation commerciale ET technique validées. */
export async function productionAutorisee(contratId: string | null | undefined) {
  if (!contratId) return { ok: false, raison: "Aucun contrat lié au site" as string | null };
  const c = await prisma.contrat.findUnique({ where: { id: contratId }, select: { premierPaiementAt: true, statut: true } });
  if (!c) return { ok: false, raison: "Contrat introuvable" };
  if (c.statut !== "SIGNE") return { ok: false, raison: "Contrat non signé" };
  if (c.premierPaiementAt) return { ok: true, raison: null };
  const [com, tech] = await Promise.all([prisma.validation.findFirst({ where: { contratId, type: "DEROGATION_PAIEMENT_COMMERCIALE", statut: "VALIDEE" } }), prisma.validation.findFirst({ where: { contratId, type: "DEROGATION_PAIEMENT_TECHNIQUE", statut: "VALIDEE" } })]);
  if (com && tech) return { ok: true, raison: null };
  return { ok: false, raison: com ? "Dérogation : accord technique d’Arsène attendu" : "Premier paiement non reçu (ou dérogation à demander)" };
}
