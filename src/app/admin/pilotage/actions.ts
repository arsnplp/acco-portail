"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { CATEGORIES } from "@/lib/finance";
import { logActivite } from "@/lib/activite";

export type ChargeState = { error?: string; ok?: string };

/** Charges (00.10 §4) : ajout / modification / archivage, Direction avec droit finance. Historique conservé. */
export async function saveCharge(id: string | null, _prev: ChargeState, fd: FormData): Promise<ChargeState> {
  const me = await requireAdmin();
  if (!can(me, "finance")) return { error: "Réservé au droit finance." };
  const nom = String(fd.get("nom") ?? "").trim();
  const montant = Math.round(parseFloat(String(fd.get("montant") ?? "").replace(",", ".")) * 100);
  const categorie = String(fd.get("categorie") ?? "autre");
  const type: "MENSUELLE" | "PONCTUELLE" = fd.get("type") === "PONCTUELLE" ? "PONCTUELLE" : "MENSUELLE";
  const debut = String(fd.get("debut") ?? "");
  if (!nom || !Number.isFinite(montant) || montant < 0 || !debut) return { error: "Nom, montant et date sont requis." };
  const data = { nom, montantCents: montant, categorie: categorie in CATEGORIES ? categorie : "autre", type, principale: fd.get("principale") === "on", debut: new Date(`${debut}T12:00:00`), fin: fd.get("fin") ? new Date(`${fd.get("fin")}T12:00:00`) : null, commentaire: String(fd.get("commentaire") ?? "").trim() || null, clientId: String(fd.get("clientId") ?? "") || null };
  if (id) await prisma.charge.update({ where: { id }, data });
  else await prisma.charge.create({ data: { ...data, createdById: me.id } });
  await logActivite({ kind: "charge", texte: `${id ? "Charge modifiée" : "Charge ajoutée"} : ${nom} (${(montant / 100).toFixed(2)} € ${type === "MENSUELLE" ? "/ mois" : "ponctuel"})`, href: "/admin/pilotage?onglet=charges", userId: me.id, clientId: data.clientId });
  revalidatePath("/admin/pilotage");
  return { ok: "Enregistré." };
}
export async function archiverCharge(id: string) {
  const me = await requireAdmin();
  if (!can(me, "finance")) return;
  const c = await prisma.charge.update({ where: { id }, data: { archivedAt: new Date() } });
  await logActivite({ kind: "charge", texte: `Charge archivée : ${c.nom}`, href: "/admin/pilotage?onglet=charges", userId: me.id });
  revalidatePath("/admin/pilotage");
}
