import Image from "next/image";
import Link from "next/link";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link href="/" aria-label="Accueil"><Image src="/brand/acco-wordmark-600.png" alt="Acco" width={600} height={134} className="brand-logo h-7 w-auto" /></Link>
      <h1 className="mt-8 text-2xl">{title}</h1>
      <div className="prose-acco mt-6 space-y-5 text-sm leading-relaxed text-text-strong [&_h2]:mt-8 [&_h2]:text-base [&_h2]:text-title [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">{children}</div>
      <p className="mt-12 text-xs text-muted"><Link href="/mentions-legales" className="underline">Mentions légales</Link> · <Link href="/confidentialite" className="underline">Politique de confidentialité</Link> · <a href="https://acco-lab.fr" className="underline">acco-lab.fr</a></p>
    </main>
  );
}
