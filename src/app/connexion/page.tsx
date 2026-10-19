import Image from "next/image";
import { LoginForm } from "./login-form";
import { GoogleButton } from "./google-button";

export const metadata = { title: "Connexion" };

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; suite?: string }>;
}) {
  const { erreur, suite } = await searchParams;
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "true";
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-10">
          <Image src="/brand/acco-wordmark-600.png" alt="Acco" width={600} height={134} priority className="h-9 w-auto" />
        </div>
        <h1 className="text-2xl mb-2">Bienvenue</h1>
        <p className="text-text mb-8">
          Entrez votre email, vous recevrez un lien pour vous connecter. Pas de mot de passe à retenir.
        </p>
        {erreur === "lien-invalide" && (
          <p className="mb-4 text-sm text-pink">Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.</p>
        )}
        {erreur === "compte-inconnu" && (
          <p className="mb-4 text-sm text-pink">Ce compte Google n’est rattaché à aucun espace Acco. Utilisez l’email avec lequel l’équipe vous a invité.</p>
        )}
        {erreur === "aucun-compte" && (
          <p className="mb-4 text-sm text-pink">
            Votre compte n’est rattaché à aucune entreprise. Contactez l’équipe Acco.
          </p>
        )}
        {googleEnabled && (
          <>
            <GoogleButton next={suite && suite.startsWith("/") ? suite : "/"} />
            <div className="my-6 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-border" />ou par email<span className="h-px flex-1 bg-border" /></div>
          </>
        )}
        <LoginForm />
        <p className="mt-10 text-xs text-muted text-center">
          Espace réservé aux clients d’Acco. <a href="/confidentialite" className="underline">Confidentialité</a>
        </p>
      </div>
    </main>
  );
}
