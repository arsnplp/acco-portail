import { redirect } from "next/navigation";
import { requireProspection } from "@/lib/auth";
/** « Mon bilan » : la fiche du commercial connecté. */
export default async function MonBilanPage() { const me = await requireProspection(); redirect(`/crm/bilan/${me.id}`); }
