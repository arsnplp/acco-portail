import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { NewPasswordForm } from "./form";

export const metadata = { title: "Nouveau mot de passe" };

export default async function NouveauMotDePasse({ searchParams }: { searchParams: Promise<{ premiere?: string }> }) {
  const { premiere } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?erreur=lien-invalide");
  const next = user.role === "ADMIN" ? "/admin" : user.role === "COMMERCIAL" ? "/crm" : "/";
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex justify-center"><Image src="/brand/acco-wordmark-600.png" alt="Acco" width={600} height={134} priority className="h-9 w-auto" /></div>
        <h1 className="mb-2 text-2xl">{premiere ? `Bienvenue ${user.firstName ?? ""}`.trim() : "Nouveau mot de passe"}</h1>
        <p className="mb-8 text-text">{premiere ? "Choisissez un mot de passe pour vos prochaines connexions. Vous resterez ensuite connecté sur cet appareil." : "Choisissez votre nouveau mot de passe."}</p>
        <NewPasswordForm next={next} />
      </div>
    </main>
  );
}
