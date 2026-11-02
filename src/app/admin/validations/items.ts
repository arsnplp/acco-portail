import { fmtDayTime, teamName } from "@/lib/crm";
import { VALIDATION_LABEL, type enAttentePour } from "@/lib/validations";
import type { ValidationItem } from "./liste";

type V = Awaited<ReturnType<typeof enAttentePour>>[number];
/** Transforme une validation Prisma en ligne affichable (contexte cliquable : site, contrat ou client). */
export function versItem(v: V, userId: string): ValidationItem {
  const contexte = v.site ? { href: `/admin/sites/${v.site.id}`, texte: `${v.site.client.name} · ${v.site.name}` }
    : v.contrat ? { href: `/admin/contrats/${v.contrat.id}`, texte: `${v.contrat.reference} · ${v.contrat.titre}` }
    : v.client ? { href: `/admin/clients/${v.client.id}`, texte: v.client.name } : null;
  return { id: v.id, label: VALIDATION_LABEL[v.type], commentaire: v.commentaire, createdAt: fmtDayTime(v.createdAt), assigne: teamName(v.assigne), pourAutrui: v.assigneId !== userId, contexte };
}
