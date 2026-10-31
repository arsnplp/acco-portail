"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProspection } from "@/lib/auth";
import { notifyClient } from "@/lib/notify";

function revalidate() {
  revalidatePath("/admin/recommandations");
  revalidatePath("/admin");
  revalidatePath("/admin/suivi");
  revalidatePath("/compte/recommandations");
}

export async function markContacted(referralId: string) {
  await requireProspection();
  await prisma.referral.updateMany({ where: { id: referralId, status: "ENVOYEE" }, data: { status: "CONTACTEE" } });
  revalidate();
}

/** « Signé » : valide la récompense paramétrée et prévient le parrain. Lie éventuellement le nouveau client. */
export async function markSigned(referralId: string, formData: FormData) {
  await requireProspection();
  const ref = await prisma.referral.findUnique({ where: { id: referralId } });
  if (!ref || ref.status === "RECOMPENSE_VALIDEE") return;
  const reward = (await prisma.setting.findUnique({ where: { key: "referral_reward_label" } }))?.value ?? "Récompense de parrainage";
  const referredClientId = String(formData.get("referredClientId") ?? "") || null;
  await prisma.referral.update({ where: { id: ref.id }, data: { status: "RECOMPENSE_VALIDEE", rewardLabel: reward, rewardedAt: new Date(), referredClientId } });
  await notifyClient({
    clientId: ref.referrerClientId, kind: "RECOMPENSE_PARRAINAGE", pref: "offers",
    title: "Merci pour votre recommandation",
    body: `${ref.contactName ?? "Votre contact"} a signé avec Acco : ${reward}.`,
    href: "/compte/recommandations",
  });
  revalidate();
}

export async function closeReferral(referralId: string) {
  await requireProspection();
  await prisma.referral.delete({ where: { id: referralId } });
  revalidate();
}
