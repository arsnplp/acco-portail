import Image from "next/image";
import Link from "next/link";
import { ForgotForm } from "./form";

export const metadata = { title: "Mot de passe oublié" };

export default function MotDePasseOublie() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-center"><Image src="/brand/acco-wordmark-600.png" alt="Acco" width={600} height={134} priority className="h-9 w-auto" /></div>
        <h1 className="mb-2 text-2xl">Mot de passe oublié</h1>
        <p className="mb-8 text-text">Entrez votre email, vous recevrez un lien pour en choisir un nouveau.</p>
        <ForgotForm />
        <p className="mt-8 text-center text-sm"><Link href="/connexion" className="text-text underline-offset-2 hover:text-title hover:underline">Retour à la connexion</Link></p>
      </div>
    </main>
  );
}
