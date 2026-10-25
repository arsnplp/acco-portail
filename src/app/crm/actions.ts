"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EchangeType, ProspectSource, ProspectStatut } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { REGLES, statutApres, addDaysParis, hostOf, normName, normPhone, parisDateTime, parisDay, parisMidnight } from "@/lib/crm";

export type CrmState = { error?: string; ok?: boolean; doublon?: { id: string; label: string; client: boolean } };

const STATUTS: ProspectStatut[] = ["A_CONTACTER", "A_RELANCER", "POSER_RDV", "RDV_POSE", "A_SIGNER", "GAGNE", "PERDU"];
const TYPES: EchangeType[] = ["NRP", "APPEL", "MAIL", "PP", "RDV", "PRISE_RDV", "NOTE"];
const SOURCES: ProspectSource[] = ["COLD_CALL", "PROSPECTION_PHYSIQUE", "RECOMMANDATION", "SITE_WEB", "AUTRE"];
const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

function refresh(id?: string) {
  revalidatePath("/crm", "layout");
  if (id) revalidatePath(`/crm/prospects/${id}`);
}

async function cibleIdFrom(name: string | null) {
  if (!name) return null;
  const nom = name.charAt(0).toUpperCase() + name.slice(1);
  const existing = (await prisma.cible.findMany()).find((c) => normName(c.nom) === normName(nom));
  return existing?.id ?? (await prisma.cible.create({ data: { nom } })).id;
}

/** Glisser-déposer d'une carte dans une autre colonne. */
export async function moveProspect(id: string, statut: ProspectStatut, motifPerte?: string) {
  await requireTeam();
  if (!STATUTS.includes(statut)) return;
  const now = new Date();
  await prisma.prospect.update({
    where: { id },
    data: {
      statut,
      gagneAt: statut === "GAGNE" ? now : undefined,
      perduAt: statut === "PERDU" ? now : statut !== "GAGNE" ? null : undefined,
      motifPerte: statut === "PERDU" ? motifPerte ?? null : null,
    },
  });
  refresh(id);
}

/** « Je reprends » ou réattribution à un autre commercial. */
export async function assignProspect(id: string, commercialId: string | null) {
  const me = await requireTeam();
  await prisma.prospect.update({ where: { id }, data: { commercialId: commercialId === "me" ? me.id : commercialId || null } });
  refresh(id);
}

/** « Noter un échange » : enregistre l'échange, met à jour statut et relance, crée le RDV si besoin. */
export async function logEchange(prospectId: string, _prev: CrmState, f: FormData): Promise<CrmState> {
  const me = await requireTeam();
  const type = f.get("type") as EchangeType;
  if (!TYPES.includes(type)) return { error: "Choisissez le type d’échange." };
  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) return { error: "Fiche introuvable." };

  const rdvDay = txt(f, "rdvDay"), rdvTime = txt(f, "rdvTime") ?? "10:00";
  if (type === "PRISE_RDV" && !rdvDay) return { error: "Indiquez la date du rendez-vous." };
  const rdvAt = rdvDay ? parisDateTime(rdvDay, rdvTime) : null;
  const relanceDay = txt(f, "relance");
  const relanceAt = relanceDay ? parisMidnight(relanceDay) : rdvAt ?? (REGLES[type].relanceJours !== null ? addDaysParis(REGLES[type].relanceJours!) : prospect.relanceAt);
  const wanted = txt(f, "statut") as ProspectStatut | null;
  const statut = wanted && STATUTS.includes(wanted) ? wanted : statutApres(type, prospect.statut);

  await prisma.$transaction(async (tx) => {
    await tx.echange.create({ data: { prospectId, type, notes: txt(f, "notes"), auteurId: me.id } });
    if (rdvAt) await tx.rendezVous.create({ data: { prospectId, commercialId: prospect.commercialId ?? me.id, debut: rdvAt, lieu: txt(f, "rdvLieu") } });
    if (type === "RDV") await tx.rendezVous.updateMany({ where: { prospectId, resultat: "PREVU", debut: { lte: new Date() } }, data: { resultat: "FAIT" } });
    await tx.prospect.update({
      where: { id: prospectId },
      data: { statut, relanceAt, commercialId: prospect.commercialId ?? me.id, perduAt: statut === "PERDU" ? new Date() : null, gagneAt: statut === "GAGNE" ? prospect.gagneAt ?? new Date() : prospect.gagneAt },
    });
  });
  refresh(prospectId);
  if (f.get("session") === "1") redirect("/crm/session");
  return { ok: true };
}

export async function deleteEchange(id: string) {
  await requireTeam();
  const e = await prisma.echange.delete({ where: { id } });
  refresh(e.prospectId ?? undefined);
}

/** Recherche de doublons : même SIREN, même téléphone, même site ou même nom (prospects et clients du portail). */
async function findDoublon(d: { societe: string; siren: string | null; telephone: string | null; siteWeb: string | null }, exceptId?: string) {
  const phone = normPhone(d.telephone), host = hostOf(d.siteWeb), name = normName(d.societe), siren = d.siren?.replace(/\s/g, "") || null;
  const prospects = await prisma.prospect.findMany({
    where: exceptId ? { id: { not: exceptId } } : {},
    select: { id: true, societe: true, siren: true, telephone: true, siteWeb: true, contacts: { select: { telephone: true } } },
  });
  const hit = prospects.find((p) =>
    (siren && p.siren?.replace(/\s/g, "") === siren) ||
    (phone && (normPhone(p.telephone) === phone || p.contacts.some((c) => normPhone(c.telephone) === phone))) ||
    (host && hostOf(p.siteWeb) === host) ||
    normName(p.societe) === name,
  );
  if (hit) return { id: hit.id, label: hit.societe, client: false };
  const clients = await prisma.client.findMany({ select: { id: true, name: true, phone: true, siren: true } });
  const c = clients.find((x) => normName(x.name) === name || (phone && normPhone(x.phone) === phone) || (siren && x.siren === siren));
  return c ? { id: c.id, label: c.name, client: true } : null;
}

export async function createProspect(_prev: CrmState, f: FormData): Promise<CrmState> {
  const me = await requireTeam();
  const societe = txt(f, "societe");
  if (!societe) return { error: "Nom de la société requis." };
  const d = { societe, siren: txt(f, "siren"), telephone: txt(f, "telephone"), siteWeb: txt(f, "siteWeb") };
  if (f.get("force") !== "1") {
    const doublon = await findDoublon(d);
    if (doublon) return { doublon, error: doublon.client ? `« ${doublon.label} » est déjà client.` : `« ${doublon.label} » existe déjà dans le CRM.` };
  }
  const source = txt(f, "source") as ProspectSource | null;
  const commercial = txt(f, "commercialId");
  const p = await prisma.prospect.create({
    data: {
      ...d,
      siteWeb: d.siteWeb ? (/^https?:\/\//.test(d.siteWeb) ? d.siteWeb : `https://${d.siteWeb}`) : null,
      adresse: txt(f, "adresse"),
      cibleId: await cibleIdFrom(txt(f, "cible")),
      source: source && SOURCES.includes(source) ? source : null,
      commercialId: commercial === "" ? null : commercial ?? me.id,
      relanceAt: parisMidnight(txt(f, "relance") ?? parisDay()),
      contacts: (txt(f, "prenom") || txt(f, "nom") || txt(f, "email"))
        ? { create: { prenom: txt(f, "prenom"), nom: txt(f, "nom"), fonction: txt(f, "fonction"), email: txt(f, "email")?.toLowerCase(), telephone: d.telephone, principal: true } }
        : undefined,
    },
  });
  refresh();
  redirect(`/crm/prospects/${p.id}`);
}

export async function updateProspect(id: string, _prev: CrmState, f: FormData): Promise<CrmState> {
  await requireTeam();
  const societe = txt(f, "societe");
  if (!societe) return { error: "Nom de la société requis." };
  const source = txt(f, "source") as ProspectSource | null;
  const statut = txt(f, "statut") as ProspectStatut | null;
  const relance = txt(f, "relance");
  const num = (k: string) => { const v = txt(f, k); return v ? Math.round(Number(v.replace(",", "."))) || null : null; };
  const site = txt(f, "siteWeb");
  await prisma.prospect.update({
    where: { id },
    data: {
      societe, siren: txt(f, "siren"), siret: txt(f, "siret"), dirigeant: txt(f, "dirigeant"), adresse: txt(f, "adresse"),
      siteWeb: site ? (/^https?:\/\//.test(site) ? site : `https://${site}`) : null, telephone: txt(f, "telephone"),
      cibleId: await cibleIdFrom(txt(f, "cible")), source: source && SOURCES.includes(source) ? source : null,
      statut: statut && STATUTS.includes(statut) ? statut : undefined, motifPerte: txt(f, "motifPerte"),
      potentielEuros: num("potentielEuros"), fraisCreationEuros: num("fraisCreationEuros"), mensuelEuros: num("mensuelEuros"),
      commercialId: txt(f, "commercialId"), relanceAt: relance ? parisMidnight(relance) : null,
    },
  });
  refresh(id);
  return { ok: true };
}

export async function saveContact(prospectId: string, contactId: string | null, _prev: CrmState, f: FormData): Promise<CrmState> {
  await requireTeam();
  const data = { prenom: txt(f, "prenom"), nom: txt(f, "nom"), fonction: txt(f, "fonction"), email: txt(f, "email")?.toLowerCase() ?? null, telephone: txt(f, "telephone"), principal: f.get("principal") === "on" };
  if (!data.prenom && !data.nom) return { error: "Prénom ou nom requis." };
  await prisma.$transaction(async (tx) => {
    if (data.principal) await tx.prospectContact.updateMany({ where: { prospectId }, data: { principal: false } });
    if (contactId) await tx.prospectContact.update({ where: { id: contactId }, data });
    else {
      const first = (await tx.prospectContact.count({ where: { prospectId } })) === 0;
      await tx.prospectContact.create({ data: { ...data, prospectId, principal: data.principal || first } });
    }
  });
  refresh(prospectId);
  return { ok: true };
}

export async function deleteContact(id: string) {
  await requireTeam();
  const c = await prisma.prospectContact.delete({ where: { id } });
  refresh(c.prospectId);
}

export async function deleteProspect(id: string) {
  const me = await requireTeam();
  if (me.role !== "ADMIN") return;
  const p = await prisma.prospect.findUnique({ where: { id } });
  if (!p || p.clientId) return; // un client du portail ne se supprime pas d'ici
  await prisma.prospect.delete({ where: { id } });
  refresh();
  redirect("/crm/pipeline");
}

export async function setRdvResultat(id: string, resultat: "FAIT" | "ANNULE" | "PREVU") {
  await requireTeam();
  const r = await prisma.rendezVous.update({ where: { id }, data: { resultat } });
  refresh(r.prospectId);
}
