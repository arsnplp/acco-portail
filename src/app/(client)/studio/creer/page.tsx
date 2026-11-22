import Link from "next/link";
import { requireClientContext } from "@/lib/auth";
import { Page } from "@/components/page";
import { BackLink } from "@/components/ui/back-link";
import { CreerForm } from "./form";

export const metadata = { title: "Créer" };

/** Studio / Création : choisir un format, décrire l'idée, l'équipe réalise dans l'univers de marque. */
export default async function CreerPage() {
  await requireClientContext();
  return (
    <Page title="À vous de créer." subtitle="Votre identité est appliquée automatiquement à vos créations.">
      <div className="-mt-4 mb-4"><BackLink fallback="/studio" label="Studio" /></div>
      <CreerForm />
      <p className="mt-6 text-sm text-text">Une création sur mesure, des réseaux à animer ? <Link href="/offres" className="underline">Voir nos services</Link>.</p>
    </Page>
  );
}
