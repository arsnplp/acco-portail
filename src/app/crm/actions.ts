"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EchangeType, ProspectSource, ProspectStatut } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { NOTE_OBLIGATOIRE, REGLES, fmtDayTime, statutApres, addDaysParis, hostOf, normName, normPhone, parisDateTime, parisDay, parisMidnight } from "@/lib/crm";

export type CrmState = { error?: string; ok?: boolean; doublon?: { id: string; label: string; client: boolean } };

const STATUTS: ProspectStatut[] = ["A_CONTACTER", "A_RELANCER", "POSER_RDV", "RDV_POSE", "A_SIGNER", "GAGNE", "PERDU"];
const TYPES: EchangeType[] = ["NRP", "APPEL", "MAIL", "PP", "RDV", "PRISE_RDV", "NO_SHOW", "NOTE"];
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
  const target = commercialId === "me" ? me.id : commercialId || null;
  if (target !== me.id && me.role !== "ADMIN") return; // attribuer à un autre (ou retirer) : admins seulement
  await prisma.prospect.update({ where: { id }, data: { commercialId: target } });
  refresh(id);
}

/** « Noter un échange » : enregistre l'échange, met à jour statut et relance, crée le RDV si besoin. */
export async function logEchange(prospectId: string, _prev: CrmState, f: FormData): Promise<CrmState> {
  const me = await requireTeam();
  const type = f.get("type") as EchangeType;
  if (!TYPES.includes(type)) return { error: "Choisissez le type d’échange." };
  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) return { error: "Fiche introuvable." };

  const notes = txt(f, "notes");
  if (NOTE_OBLIGATOIRE.includes(type) && !notes) return { error: "La note est obligatoire pour ce type d’échange." };
  const rdvDay = txt(f, "rdvDay"), rdvTime = txt(f, "rdvTime") ?? "10:00";
  if (type === "PRISE_RDV" && !rdvDay) return { error: "Indiquez la date du rendez-vous." };
  const rdvAt = type === "PRISE_RDV" && rdvDay ? parisDateTime(rdvDay, rdvTime) : null;
  // No show recalé : nouvelle date, enregistrée comme report (pas comme un nouveau RDV pris).
  const reportDay = type === "NO_SHOW" && f.get("report") === "1" ? txt(f, "reportDay") : null;
  if (type === "NO_SHOW" && f.get("report") === "1" && !reportDay) return { error: "Indiquez la nouvelle date du rendez-vous." };
  const reportAt = reportDay ? parisDateTime(reportDay, txt(f, "reportTime") ?? "10:00") : null;
  const relanceDay = txt(f, "relance"), relanceHeure = txt(f, "relanceHeure");
  // Heure facultative : la relance devient un rappel (push + bandeau) au commercial à cette heure-là.
  const rappelAt = relanceDay && relanceHeure ? parisDateTime(relanceDay, relanceHeure) : null;
  const relanceAt = rappelAt ?? (relanceDay ? parisMidnight(relanceDay) : rdvAt ?? reportAt ?? (REGLES[type].relanceJours !== null ? addDaysParis(REGLES[type].relanceJours!) : prospect.relanceAt));
  const wanted = txt(f, "statut") as ProspectStatut | null;
  const statut = wanted && STATUTS.includes(wanted) ? wanted : statutApres(type, prospect.statut);

  await prisma.$transaction(async (tx) => {
    await tx.echange.create({ data: { prospectId, type, notes: reportAt ? `${notes ? notes + "\n" : ""}RDV reporté au ${fmtDayTime(reportAt)}` : notes, auteurId: me.id } });
    if (rdvAt) await tx.rendezVous.create({ data: { prospectId, commercialId: prospect.commercialId ?? me.id, debut: rdvAt, lieu: txt(f, "rdvLieu") } });
    if (type === "RDV" || type === "NO_SHOW") {
      // Le RDV concerné : le dernier prévu déjà commencé, sinon le dernier passé (ex. importé « fait »), sinon le prochain prévu.
      const soon = new Date(Date.now() + 3 * 3600_000);
      const rdv = (await tx.rendezVous.findFirst({ where: { prospectId, resultat: "PREVU", debut: { lte: soon } }, orderBy: { debut: "desc" } }))
        ?? (await tx.rendezVous.findFirst({ where: { prospectId, resultat: { in: ["FAIT", "NO_SHOW"] }, debut: { lte: soon } }, orderBy: { debut: "desc" } }))
        ?? (await tx.rendezVous.findFirst({ where: { prospectId, resultat: "PREVU" }, orderBy: { debut: "asc" } }));
      if (rdv) await tx.rendezVous.update({ where: { id: rdv.id }, data: { resultat: type === "RDV" ? "FAIT" : "NO_SHOW" } });
      if (reportAt) await tx.rendezVous.create({ data: { prospectId, commercialId: rdv?.commercialId ?? prospect.commercialId ?? me.id, debut: reportAt, lieu: txt(f, "reportLieu") ?? rdv?.lieu ?? null, reportDeId: rdv?.id ?? null } });
    }
    await tx.prospect.update({
      where: { id: prospectId },
      data: { statut, relanceAt, rappelAt, rappelEnvoyeAt: null, commercialId: prospect.commercialId ?? me.id, perduAt: statut === "PERDU" ? new Date() : null, gagneAt: statut === "GAGNE" ? prospect.gagneAt ?? new Date() : prospect.gagneAt },
    });
  });
  refresh(prospectId);
  const session = String(f.get("session") ?? "");
  if (session) redirect(`/crm/session?${session}`); // session d'appels : fiche suivante de la colonne
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
      commercialId: me.role !== "ADMIN" ? me.id : commercial === "" ? null : commercial ?? me.id,
      relanceAt: txt(f, "relanceHeure") ? parisDateTime(txt(f, "relance") ?? parisDay(), txt(f, "relanceHeure")!) : parisMidnight(txt(f, "relance") ?? parisDay()),
      rappelAt: txt(f, "relanceHeure") ? parisDateTime(txt(f, "relance") ?? parisDay(), txt(f, "relanceHeure")!) : null,
      contacts: (txt(f, "prenom") || txt(f, "nom") || txt(f, "email"))
        ? { create: { prenom: txt(f, "prenom"), nom: txt(f, "nom"), fonction: txt(f, "fonction"), email: txt(f, "email")?.toLowerCase(), telephone: d.telephone, principal: true } }
        : undefined,
    },
  });
  refresh();
  redirect(`/crm/prospects/${p.id}`);
}

export async function updateProspect(id: string, _prev: CrmState, f: FormData): Promise<CrmState> {
  const me = await requireTeam();
  const societe = txt(f, "societe");
  if (!societe) return { error: "Nom de la société requis." };
  const source = txt(f, "source") as ProspectSource | null;
  const statut = txt(f, "statut") as ProspectStatut | null;
  const relance = txt(f, "relance"), relanceHeure = txt(f, "relanceHeure");
  const rappelAt = relance && relanceHeure ? parisDateTime(relance, relanceHeure) : null;
  const before = await prisma.prospect.findUnique({ where: { id }, select: { rappelAt: true, commercialId: true } });
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
      commercialId: me.role === "ADMIN" ? txt(f, "commercialId") : before?.commercialId ?? null,
      relanceAt: rappelAt ?? (relance ? parisMidnight(relance) : null), rappelAt,
      rappelEnvoyeAt: rappelAt && before?.rappelAt?.getTime() === rappelAt.getTime() ? undefined : null,
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

export async function setRdvResultat(id: string, resultat: "FAIT" | "ANNULE" | "PREVU" | "NO_SHOW") {
  await requireTeam();
  const r = await prisma.rendezVous.update({ where: { id }, data: { resultat } });
  refresh(r.prospectId);
}
