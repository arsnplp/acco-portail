import { CreditCardIcon } from "lucide-react";
import { requireProspection } from "@/lib/auth";
import { LiensPaiement } from "@/components/crm/liens-paiement";

export const metadata = { title: "Liens de paiement" };

/** Liens de paiement Stripe pour les commerciaux : offres et paliers « client référence », copiables en un clic. */
export default async function LiensPage() {
  await requireProspection();
  return (
    <main className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-8">
      <div className="flex items-center gap-2">
        <CreditCardIcon size={20} className="text-text" aria-hidden />
        <h1 className="text-2xl">Liens de paiement</h1>
      </div>
      <p className="mt-1 mb-5 text-sm text-text">À envoyer au client en rendez-vous ou juste après : un clic copie le lien. Les mêmes liens sont accessibles depuis chaque fiche prospect (bouton carte bancaire).</p>
      <LiensPaiement />
    </main>
  );
}
