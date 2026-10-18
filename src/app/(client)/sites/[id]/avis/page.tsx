import { Lock, Star, Sparkles } from "lucide-react";
import { requireClientSite } from "@/lib/sites";
import { hasModule } from "@/lib/offers";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";

export const metadata = { title: "Avis" };

export default async function AvisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site } = await requireClientSite(id);
  const unlocked = await hasModule(site.id, "AVIS");

  if (!unlocked) {
    const offer = await prisma.offer.findFirst({ where: { module: "AVIS", isArchived: false }, select: { slug: true, name: true } });
    return (
      <div className="relative">
        <div className="pointer-events-none select-none blur-[6px] opacity-60" aria-hidden>
          <Card className="flex items-center gap-4">
            <span className="font-title text-4xl font-extrabold text-title">4,8</span>
            <div><div className="flex gap-0.5 text-yellow">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={16} fill="currentColor" />)}</div><p className="text-sm text-text">127 avis · 6 ce mois-ci</p></div>
          </Card>
          <div className="mt-3 grid gap-2">
            {["Super accueil, produits frais, je recommande !", "Très satisfaite, équipe à l’écoute.", "Un peu d’attente mais ça vaut le coup."].map((t, i) => (
              <Card key={i} className="py-3"><div className="flex gap-0.5 text-yellow">{[1, 2, 3, 4, 5].map((j) => <Star key={j} size={12} fill="currentColor" />)}</div><p className="mt-2 text-sm text-text-strong">{t}</p><p className="mt-2 text-xs text-blue">Réponse proposée · Publier</p></Card>
            ))}
          </div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm text-center shadow-2xl shadow-black/60">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-border text-yellow"><Lock size={20} /></span>
            <h2 className="mt-4 text-lg">Vos avis Google, ici</h2>
            <p className="mt-2 text-sm text-text">Recevez plus d’avis grâce à la plaquette de comptoir NFC + QR, et répondez en un tap avec une réponse déjà rédigée.</p>
            <Button href={`/offres#${offer?.slug ?? ""}`} className="mt-5 w-full">Débloquer avec la plaquette avis Google</Button>
          </Card>
        </div>
      </div>
    );
  }

  return <Empty icon={Sparkles} title="Module Avis Google actif" text="La synchronisation de vos avis et les réponses proposées arrivent à l’étape 7." />;
}
