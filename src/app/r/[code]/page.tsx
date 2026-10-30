import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LeadForm } from "./lead-form";
import { CheckIcon } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const c = await prisma.client.findUnique({ where: { referralCode: code }, include: { memberships: { where: { role: "OWNER" }, include: { user: true }, take: 1 } } });
  const who = c?.memberships[0]?.user.firstName ?? c?.name;
  return { title: who ? `${who} vous recommande Acco` : "Acco" };
}

export default async function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const client = await prisma.client.findUnique({ where: { referralCode: code }, include: { memberships: { where: { role: "OWNER" }, include: { user: true }, take: 1 }, sites: { where: { status: "EN_LIGNE" }, take: 1 } } });
  if (!client) notFound();
  const who = client.memberships[0]?.user.firstName ?? client.name;
  const site = client.sites[0];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-10">
      <Image src="/brand/acco-wordmark-600.png" alt="Acco" width={600} height={134} className="brand-logo h-8 w-auto" priority />
      <h1 className="mt-8 text-2xl leading-tight">{who} vous recommande Acco</h1>
      <p className="mt-3 text-text">
        Acco crée des sites internet simples et efficaces pour les commerçants et artisans, par abonnement, sans frais cachés.
        {site?.url && <> Découvrez le site de {client.name} : <a href={site.url} target="_blank" rel="noreferrer" className="text-title underline">{site.url.replace(/^https?:\/\//, "")}</a>.</>}
      </p>
      <ul className="mt-5 space-y-2 text-sm text-text-strong">
        <li className="flex gap-2"><CheckIcon size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-green" aria-hidden /> Un site en ligne en quelques semaines, maquette validée par vous</li>
        <li className="flex gap-2"><CheckIcon size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-green" aria-hidden /> Les demandes de vos clients et vos visites Google dans une app</li>
        <li className="flex gap-2"><CheckIcon size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-green" aria-hidden /> Des modifications à la demande, une équipe à Paris qui répond</li>
      </ul>
      <div className="mt-8"><LeadForm code={code} /></div>
      <p className="mt-10 text-center text-xs text-muted"><a href="/confidentialite" className="underline">Confidentialité</a> · acco-lab.fr</p>
    </main>
  );
}
