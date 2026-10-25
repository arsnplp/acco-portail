"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { generateLeadList } from "@/lib/leads/generate";
import type { LeadRow } from "@/lib/leads/colonnes";
import { formatTel, hostOf, nettoyerNom, normName, normPhone, parisDay, parisMidnight } from "@/lib/crm";

export type LeadState = { error?: string; ok?: string };

function refresh(id?: string) {
  revalidatePath("/crm/leads");
  if (id) revalidatePath(`/crm/leads/${id}`);
}

/** Lance la génération d'une liste (elle tourne en arrière-plan, 2 à 5 minutes). */
export async function createLeadList(_prev: LeadState, f: FormData): Promise<LeadState> {
  const me = await requireTeam();
  const demande = Math.round(Number(f.get("nombre")));
  const secteur = String(f.get("secteur") ?? "").trim();
  const region = String(f.get("region") ?? "").trim();
  if (!Number.isFinite(demande) || demande < 1 || demande > 50) return { error: "Choisissez un nombre de leads entre 1 et 50." };
  if (secteur.length < 3) return { error: "Indiquez le secteur d’activité (ex. esthéticienne, auto-école)." };
  if (region.length < 3) return { error: "Indiquez la région ou les villes (ex. Aix-en-Provence et Marseille)." };
  const wanted = String(f.get("commercialId") ?? "");
  const commercialId = me.role === "ADMIN" ? wanted || null : wanted === me.id ? me.id : null;
  const enCours = await prisma.leadListe.count({ where: { statut: "GENERATION", createdAt: { gte: new Date(Date.now() - 20 * 60_000) } } });
  if (enCours >= 3) return { error: "Trois listes sont déjà en cours de génération. Attendez qu’une se termine." };
  const filtreSite = ["SANS", "AVEC"].includes(String(f.get("site"))) ? String(f.get("site")) : null;
  const mobileSeul = f.get("mobile") === "on";
  const liste = await prisma.leadListe.create({ data: { secteur, region, demande, commercialId, auteurId: me.id, mobileSeul, filtreSite } });
  after(() => generateLeadList(liste.id));
  refresh();
  return { ok: `Génération lancée : ${demande} lead${demande > 1 ? "s" : ""} ${secteur} · ${region}. Comptez 2 à 5 minutes, la liste apparaît dans le coffre.` };
}

export async function retryLeadList(id: string) {
  await requireTeam();
  const l = await prisma.leadListe.update({ where: { id }, data: { statut: "GENERATION", erreur: null, message: null } });
  after(() => generateLeadList(l.id));
  refresh(id);
}

export async function assignLeadList(id: string, commercialId: string | null) {
  const me = await requireTeam();
  if (me.role !== "ADMIN" && commercialId && commercialId !== me.id) return;
  await prisma.leadListe.update({ where: { id }, data: { commercialId: commercialId || null } });
  refresh(id);
}

export async function deleteLead(id: string) {
  await requireTeam();
  const l = await prisma.lead.findUnique({ where: { id } });
  if (!l || l.prospectId) return;
  await prisma.$transaction([prisma.lead.delete({ where: { id } }), prisma.leadListe.update({ where: { id: l.listeId }, data: { obtenus: { decrement: 1 } } })]);
  refresh(l.listeId);
}

export async function deleteLeadList(id: string) {
  const me = await requireTeam();
  const l = await prisma.leadListe.findUnique({ where: { id }, include: { _count: { select: { leads: { where: { prospectId: { not: null } } } } } } });
  if (!l || (me.role !== "ADMIN" && l.auteurId !== me.id)) return;
  await prisma.leadListe.delete({ where: { id } }); // les prospects déjà créés restent dans le CRM
  refresh();
}

/** « VENTRE (MONTEIRO) Laetitia » → nom VENTRE, prénom Laetitia. */
function splitDirigeant(s: string | null) {
  if (!s) return null;
  const clean = s.replace(/\([^)]*\)/g, " ").split("/")[0].replace(/\s+/g, " ").trim();
  const words = clean.split(" ");
  const nom = words.filter((w) => w.length > 1 && w === w.toUpperCase()).join(" ");
  const prenom = words.filter((w) => w !== w.toUpperCase())[0] ?? null;
  return nom || prenom ? { nom: nettoyerNom(nom || null), prenom: nettoyerNom(prenom) } : null;
}

/** Envoie les leads de la liste dans « À contacter » (en sautant ceux déjà présents dans le CRM). */
export async function sendListToProspects(id: string): Promise<LeadState> {
  const me = await requireTeam();
  const liste = await prisma.leadListe.findUnique({ where: { id }, include: { leads: { where: { prospectId: null } } } });
  if (!liste) return { error: "Liste introuvable." };
  if (liste.statut === "GENERATION") return { error: "La liste est encore en cours de génération." };

  const existants = await prisma.prospect.findMany({ select: { id: true, societe: true, telephone: true, siren: true, siteWeb: true } });
  const phones = new Set(existants.map((p) => normPhone(p.telephone)).filter(Boolean));
  const sirens = new Set(existants.map((p) => p.siren).filter(Boolean));
  const hosts = new Set(existants.map((p) => hostOf(p.siteWeb)).filter(Boolean));
  const noms = new Set(existants.map((p) => normName(p.societe)));
  const cible = liste.secteur.charAt(0).toUpperCase() + liste.secteur.slice(1).toLowerCase();
  const cibleRow = (await prisma.cible.findMany()).find((c) => normName(c.nom) === normName(cible)) ?? (await prisma.cible.create({ data: { nom: cible } }));
  const relanceAt = parisMidnight(parisDay());

  let crees = 0, sautes = 0;
  for (const lead of liste.leads) {
    const d = lead.donnees as LeadRow;
    const tel = normPhone(lead.telephone);
    if (!tel) { sautes++; continue; } // sans numéro : inutilisable en prospection téléphonique
    if ((tel && phones.has(tel)) || (lead.siren && sirens.has(lead.siren)) || (hostOf(lead.siteWeb) && hosts.has(hostOf(lead.siteWeb))) || noms.has(normName(lead.entreprise))) { sautes++; continue; }
    const dir = splitDirigeant((d.Dirigeant as string) ?? null);
    const resume = [
      `Lead généré (${liste.secteur} · ${liste.region}) : score ${d.Score ?? "?"}`,
      d["Note Google"] ? `note Google ${d["Note Google"]} (${d["Avis Google"] ?? 0} avis)` : null,
      d["Faiblesses SEO"] ? `à noter : ${d["Faiblesses SEO"]}` : null,
      d._source ? `source : ${d._source}` : null,
    ].filter(Boolean).join(" · ");
    const p = await prisma.prospect.create({
      data: {
        societe: lead.entreprise, telephone: formatTel(lead.telephone), siteWeb: lead.siteWeb, siren: lead.siren, siret: (d.SIRET as string) ?? null,
        dirigeant: (d.Dirigeant as string) ?? null, adresse: (d.Adresse as string) ?? lead.ville, cibleId: cibleRow.id, source: "COLD_CALL",
        statut: "A_CONTACTER", commercialId: liste.commercialId, relanceAt,
        contacts: dir ? { create: { prenom: dir.prenom, nom: dir.nom, fonction: (d["Rôle"] as string) ?? null, telephone: formatTel(lead.telephone), email: (d.Email as string) ?? null, principal: true } } : undefined,
        echanges: { create: { type: "NOTE", notes: resume, auteurId: me.id, origine: "lead" } },
      },
    });
    await prisma.lead.update({ where: { id: lead.id }, data: { prospectId: p.id } });
    if (tel) phones.add(tel);
    noms.add(normName(lead.entreprise));
    crees++;
  }
  await prisma.leadListe.update({ where: { id }, data: { statut: "UTILISEE", utiliseeAt: new Date() } });
  refresh(id);
  revalidatePath("/crm/pipeline");
  return { ok: `${crees} lead${crees > 1 ? "s" : ""} ajouté${crees > 1 ? "s" : ""} dans « À contacter »${sautes ? `, ${sautes} ignoré${sautes > 1 ? "s" : ""} (déjà dans le CRM ou sans numéro)` : ""}.` };
}
