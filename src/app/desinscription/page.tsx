import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { jetonDesinscription } from "@/lib/campagnes";

export const metadata = { title: "Désinscription" };

/** Lien de désinscription des messages commerciaux (00.4) : un clic, aucune connexion. Les messages de service continuent. */
export default async function DesinscriptionPage({ searchParams }: { searchParams: Promise<{ c?: string; t?: string }> }) {
  const { c, t } = await searchParams;
  let ok = false;
  if (c && t && jetonDesinscription(c) === t) {
    const r = await prisma.prospectContact.updateMany({ where: { id: c }, data: { optOutCommercial: true } });
    ok = r.count > 0;
  }
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-10">
      <Image src="/brand/acco-wordmark-600.png" alt="ACCO LAB" width={600} height={134} className="brand-logo h-8 w-auto" priority />
      <h1 className="mt-8 text-2xl leading-tight">{ok ? "C’est noté" : "Lien invalide"}</h1>
      <p className="mt-3 text-text">{ok ? "Vous ne recevrez plus nos messages d’information commerciale. Les messages liés à votre site (demandes, documents, rendez-vous) continuent de vous parvenir." : "Ce lien de désinscription n’est pas valide. Répondez « STOP » à l’email reçu : cela suffit."}</p>
    </main>
  );
}
