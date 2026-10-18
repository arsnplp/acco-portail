import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion" };

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-10">
          <Image src="/brand/logo-acco.webp" alt="Acco" width={140} height={44} priority className="h-10 w-auto" />
        </div>
        <h1 className="text-2xl mb-2">Bienvenue</h1>
        <p className="text-text mb-8">
          Entrez votre email, vous recevrez un lien pour vous connecter. Pas de mot de passe à retenir.
        </p>
        {erreur === "lien-invalide" && (
          <p className="mb-4 text-sm text-pink">Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.</p>
        )}
        {erreur === "aucun-compte" && (
          <p className="mb-4 text-sm text-pink">
            Votre compte n’est rattaché à aucune entreprise. Contactez l’équipe Acco.
          </p>
        )}
        <LoginForm />
        <p className="mt-10 text-xs text-muted text-center">
          Espace réservé aux clients d’Acco. <a href="/confidentialite" className="underline">Confidentialité</a>
        </p>
      </div>
    </main>
  );
}
