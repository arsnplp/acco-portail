"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { sendPushToUser } from "@/lib/push";
import { sendEmail, layout, appUrl } from "@/lib/email";
import { excerpt } from "@/lib/notify";
import { teamName } from "@/lib/crm";

export type SignalementState = { ok?: boolean; error?: string };

/** Direction → commercial attitré : demande d'informations ou de rectification sur une fiche. Arrive dans ses Messages, en push et par email. */
export async function signalerAuCommercial(prospectId: string, message: string): Promise<SignalementState> {
  const me = await getCurrentUser();
  if (!me || !can(me, "pilotage")) return { error: "Réservé à la Direction." };
  const texte = message.trim();
  if (texte.length < 3) return { error: "Écrivez le message à transmettre." };
  const p = await prisma.prospect.findUnique({ where: { id: prospectId }, select: { societe: true, commercial: { select: { id: true, email: true, firstName: true } } } });
  if (!p) return { error: "Fiche introuvable." };
  if (!p.commercial) return { error: "Cette fiche n’a pas de commercial attitré : attribuez-la d’abord (« Suivi par »)." };
  const s = await prisma.signalement.create({ data: { prospectId, deId: me.id, versId: p.commercial.id, message: texte.slice(0, 2000) } });
  const href = `/crm/prospects/${prospectId}?signalement=${s.id}`;
  const titre = `${teamName(me)} vous signale la fiche ${p.societe}`;
  await Promise.all([
    sendPushToUser(p.commercial.id, { title: titre, body: excerpt(texte), url: appUrl(href), tag: "signalement" }).catch(() => null),
    sendEmail({ to: p.commercial.email, subject: titre, text: `${texte}\n\nOuvrir la fiche : ${appUrl(href)}`, html: layout(titre, `<p style="white-space:pre-line">${texte.replace(/</g, "&lt;")}</p>`, { label: "Ouvrir la fiche", href: appUrl(href) }) }).catch(() => null),
  ]);
  revalidatePath(`/crm/prospects/${prospectId}`);
  revalidatePath("/admin/messages");
  return { ok: true };
}

/** Le commercial (ou la Direction) marque la demande comme traitée : elle disparaît des Messages et du bandeau de la fiche. */
export async function traiterSignalement(id: string) {
  const me = await getCurrentUser();
  if (!me || me.role === "CLIENT") return;
  const s = await prisma.signalement.findUnique({ where: { id }, select: { prospectId: true, versId: true, deId: true } });
  if (!s) return;
  if (s.versId !== me.id && s.deId !== me.id && !can(me, "pilotage")) return;
  await prisma.signalement.update({ where: { id }, data: { traiteAt: new Date(), luAt: new Date() } });
  revalidatePath(`/crm/prospects/${s.prospectId}`);
  revalidatePath("/admin/messages");
  revalidatePath("/crm", "layout");
}
