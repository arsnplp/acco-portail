"use server";

import { revalidatePath } from "next/cache";
import type { PeriodeBilan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProspection } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { INDICATEURS, parseDebut, type Indicateur } from "@/lib/bilans";
import { logActivite } from "@/lib/activite";

export type BilanState = { error?: string; ok?: string };
const PER: PeriodeBilan[] = ["HEBDO", "MENSUEL", "TRIMESTRIEL", "ANNUEL"];
const num = (v: FormDataEntryValue | null) => { const s = String(v ?? "").trim().replace(/\s/g, "").replace(",", "."); if (!s) return null; const n = Math.round(Number(s)); return Number.isFinite(n) && n >= 0 ? n : NaN; };

/**
 * Objectifs d'une période : le commercial fixe ses objectifs personnels et ses engagements sur sa propre fiche ;
 * la Direction (droit pilotage) fixe l'objectif « fixé ». Un administrateur-commercial en mode Direction fait les deux.
 */
export async function saveObjectifs(userId: string, periode: PeriodeBilan, debutKey: string, _prev: BilanState, fd: FormData): Promise<BilanState> {
  const me = await requireProspection();
  if (!PER.includes(periode)) return { error: "Période inconnue." };
  const soi = me.id === userId, direction = can(me, "pilotage");
  if (!soi && !direction) return { error: "Réservé au commercial et à la Direction." };
  const debut = parseDebut(debutKey);
  for (const i of INDICATEURS) {
    const data: { personnel?: number | null; engagement?: number | null; fixe?: number | null; fixeParId?: string | null } = {};
    if (soi) { const p = num(fd.get(`${i.key}_personnel`)), e = num(fd.get(`${i.key}_engagement`)); if (Number.isNaN(p) || Number.isNaN(e)) return { error: `${i.label} : nombre attendu.` }; data.personnel = p; data.engagement = e; }
    if (direction) { const f = num(fd.get(`${i.key}_fixe`)); if (Number.isNaN(f)) return { error: `${i.label} : nombre attendu.` }; data.fixe = f; data.fixeParId = f === null ? null : me.id; }
    await prisma.objectifCommercial.upsert({ where: { userId_periode_debut_indicateur: { userId, periode, debut, indicateur: i.key } }, create: { userId, periode, debut, indicateur: i.key, ...data }, update: data });
  }
  revalidatePath(`/crm/bilan/${userId}`);
  return { ok: "Objectifs enregistrés." };
}

/** Compte rendu de période (hebdo, mensuel, trimestriel, annuel) : par le commercial ou la Direction. */
export async function ajouterBilan(userId: string, periode: PeriodeBilan, debutKey: string, _prev: BilanState, fd: FormData): Promise<BilanState> {
  const me = await requireProspection();
  if (me.id !== userId && !can(me, "pilotage")) return { error: "Réservé au commercial et à la Direction." };
  const contenu = String(fd.get("contenu") ?? "").trim();
  if (contenu.length < 5) return { error: "Écrivez le compte rendu." };
  await prisma.bilanCommercial.create({ data: { userId, periode, debut: parseDebut(debutKey), contenu: contenu.slice(0, 20_000), auteurId: me.id } });
  await logActivite({ kind: "bilan", texte: `Bilan ${periode.toLowerCase()} ajouté`, href: `/crm/bilan/${userId}?periode=${periode}&debut=${debutKey}`, userId: me.id }).catch(() => null);
  revalidatePath(`/crm/bilan/${userId}`);
  return { ok: "Compte rendu ajouté." };
}

export async function supprimerBilan(id: string) {
  const me = await requireProspection();
  const b = await prisma.bilanCommercial.findUnique({ where: { id } });
  if (!b || (b.auteurId !== me.id && !can(me, "pilotage"))) return;
  await prisma.bilanCommercial.delete({ where: { id } });
  revalidatePath(`/crm/bilan/${b.userId}`);
}
export type { Indicateur };
