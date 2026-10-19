import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion" };

const ERRORS: Record<string, string> = {
  "lien-invalide": "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.",
  "aucun-compte": "Votre compte n’est rattaché à aucune entreprise. Contactez l’équipe Acco.",
  "mdp-change": "Mot de passe changé. Connectez-vous.",
};

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<{ erreur?: string; suite?: string; info?: string }> }) {
  const { erreur, suite, info } = await searchParams;
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-center"><Image src="/brand/acco-wordmark-600.png" alt="Acco" width={600} height={134} priority className="h-9 w-auto" /></div>
        <h1 className="mb-2 text-2xl">Bienvenue</h1>
        <p className="mb-8 text-text">Votre espace client Acco. Vous restez connecté sur cet appareil.</p>
        {erreur && ERRORS[erreur] && <p className="mb-4 text-sm text-pink">{ERRORS[erreur]}</p>}
        {info && ERRORS[info] && <p className="mb-4 text-sm text-green">{ERRORS[info]}</p>}
        <LoginForm next={suite && suite.startsWith("/") ? suite : "/"} />
        <p className="mt-10 text-center text-xs text-muted">Espace réservé aux clients d’Acco. <a href="/confidentialite" className="underline">Confidentialité</a></p>
      </div>
    </main>
  );
}
