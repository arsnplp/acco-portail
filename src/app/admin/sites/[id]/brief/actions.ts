"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { requireSiteAcces } from "@/lib/perimetre";
import { can, estExterne } from "@/lib/permissions";
import { chargerBrief, completude, lireContenu, majSection, type EtatSection } from "@/lib/brief";
import { demanderValidation, peutDecider } from "@/lib/validations";
import { logActivite } from "@/lib/activite";
import { teamName } from "@/lib/crm";

export type BriefState = { error?: string; ok?: string };
const ETATS: EtatSection[] = ["ATTENDU", "RECU", "INCOMPLET", "VALIDE"];

/** Le commercial (ou l'équipe) remplit une section et fixe son état. */
export async function saveBriefSection(siteId: string, key: string, _prev: BriefState, fd: FormData): Promise<BriefState> {
  const me = await requireTeam();
  await requireSiteAcces(me, siteId);
  const etat = String(fd.get("etat") ?? "");
  await majSection(siteId, key, { texte: String(fd.get("texte") ?? "").slice(0, 8000), etat: ETATS.includes(etat as EtatSection) ? (etat as EtatSection) : undefined }, teamName(me));
  revalidatePath(`/admin/sites/${siteId}/brief`); revalidatePath(`/admin/sites/${siteId}`); revalidatePath(`/sites/${siteId}`, "layout");
  return { ok: "Enregistré." };
}

/** Demande la double validation (commercial référent, puis Arsène) une fois le brief complet. */
export async function demanderValidationBrief(siteId: string): Promise<BriefState> {
  const me = await requireTeam();
  await requireSiteAcces(me, siteId);
  if (estExterne(me)) return { error: "Réservé à l’équipe interne." };
  const b = await chargerBrief(siteId);
  const c = completude(lireContenu(b.contenu), !!b.derogationAt);
  if (!c.complet) return { error: `Brief incomplet : ${c.manquantes.map((s) => s.label).slice(0, 3).join(", ")}${c.manquantes.length > 3 ? "…" : ""}. Les points non essentiels peuvent être levés par Arsène (carte blanche).` };
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { name: true, clientId: true, client: { select: { commercial: { select: { id: true, role: true, email: true, droits: true } } } } } });
  // Le référent ne reçoit la ligne que s'il peut la décider ; sinon les validateurs commerciaux par défaut (Bilel, Lucas).
  const ref = site.client.commercial;
  const assigneId = ref && peutDecider(ref, "BRIEF_COMMERCIAL") ? ref.id : undefined;
  if (b.validCommercialAt) return { ok: "Validation commerciale déjà acquise : accord technique d’Arsène en attente." };
  const n = await demanderValidation({ type: "BRIEF_COMMERCIAL", siteId, clientId: site.clientId, demandeParId: me.id, commentaire: `${site.name} : brief complet`, href: `/admin/sites/${siteId}/brief`, ...(assigneId && { assigneId }) });
  await prisma.brief.update({ where: { siteId }, data: { etat: "COMPLET" } });
  await logActivite({ kind: "validation", texte: `${site.name} : brief complet, validation commerciale demandée`, href: `/admin/sites/${siteId}/brief`, userId: me.id, clientId: site.clientId, siteId });
  revalidatePath(`/admin/sites/${siteId}/brief`); revalidatePath("/admin");
  return n ? { ok: "Validation commerciale demandée au référent ; Arsène sera sollicité ensuite." } : { ok: "Demande déjà en attente." };
}

/** Dérogation d'Arsène (10.3) : lever les points non essentiels manquants, avec justification tracée. Jamais les points critiques. */
export async function derogerBrief(siteId: string, _prev: BriefState, fd: FormData): Promise<BriefState> {
  const me = await requireTeam();
  if (!can(me, "validation_technique")) return { error: "Réservé à Arsène (validation technique)." };
  const note = String(fd.get("note") ?? "").trim();
  if (!note) return { error: "Justifiez la dérogation (carte blanche du client, points levés)." };
  const b = await chargerBrief(siteId);
  const c = completude(lireContenu(b.contenu), true);
  if (c.essentielles.length) return { error: `Impossible : informations essentielles manquantes (${c.essentielles.map((s) => s.label).join(", ")}).` };
  await prisma.brief.update({ where: { siteId }, data: { derogationNote: note, derogationParId: me.id, derogationAt: new Date() } });
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId }, select: { name: true, clientId: true } });
  await logActivite({ kind: "validation", texte: `${site.name} : dérogation d’Arsène sur les points non essentiels du brief (${note})`, href: `/admin/sites/${siteId}/brief`, userId: me.id, clientId: site.clientId, siteId });
  revalidatePath(`/admin/sites/${siteId}/brief`);
  return { ok: "Dérogation enregistrée : les points non essentiels manquants sont levés." };
}
