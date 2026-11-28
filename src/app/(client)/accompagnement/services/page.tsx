import { CheckIcon } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { BackLink } from "@/components/ui/back-link";
import { SubmitButton } from "@/components/ui/submit-button";
import { PRESTATIONS, PRESTATION_KEYS, POINT } from "@/lib/prestations";
import { servicesSouscrits } from "@/lib/services-client";
import { Art } from "../../studio/art";
import { demanderPrestation } from "../actions";

export const metadata = { title: "Nos services" };

/** Accompagnement → Nos services : toutes les prestations ACCO, avec « Demander un devis » (une demande par prestation, part dans Messages). */
export default async function ServicesAccoPage() {
  const { client } = await requireClientContext();
  const [demandees, souscrits, blog] = await Promise.all([
    prisma.activite.findMany({ where: { clientId: client.id, kind: { startsWith: "prestation_" } }, select: { kind: true } }),
    servicesSouscrits(client.id),
    prisma.subscription.findMany({ where: { clientId: client.id, status: "ACTIF" }, select: { label: true, offer: { select: { name: true } } } }),
  ]);
  const deja = new Set(demandees.map((a) => a.kind.replace("prestation_", "")));
  const blogOn = blog.some((s) => /blog|article|contenu|rédac|redac/.test(`${s.label} ${s.offer?.name ?? ""}`.toLowerCase()));
  const inclus: Record<string, boolean> = { site: souscrits.site, google: souscrits.google, ads: souscrits.ads, blog: blogOn };

  return (
    <Page title={<><BackLink fallback="/accompagnement" label="Accompagnement" className="mb-3" /><span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2.4px] text-text"><span className="size-2 rounded-full bg-green" /> Nos expertises</span>Aller plus loin.</>} subtitle="Toutes les prestations ACCO. Demandez un devis : votre conseiller vous répond dans Messages.">
      <div className="grid gap-3">
        {PRESTATION_KEYS.map((k) => { const p = PRESTATIONS[k]; const on = inclus[k]; const sent = deja.has(k); return (
          <section key={k} id={k} className="flex items-center gap-4 rounded-card border border-border bg-surface p-4 scroll-mt-4">
            <Art kind={p.art} label="ACCO / Services" className="h-28 w-[36%] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px] text-text"><span className={`size-2 rounded-full ${POINT[p.couleur]}`} /> {on ? "Inclus dans votre accompagnement" : "Aller plus loin"}</p>
              <h2 className="mt-1 text-lg font-bold text-title">{p.titre}.</h2>
              <p className="text-sm text-text">{p.texte}</p>
              {on ? <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-green"><CheckIcon size={14} /> Déjà en place</p>
                : sent ? <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-green"><CheckIcon size={14} /> Devis demandé, réponse dans Messages</p>
                : <form action={demanderPrestation.bind(null, k)} className="mt-2"><SubmitButton size="sm" pendingLabel="Envoi…">Demander un devis</SubmitButton></form>}
            </div>
          </section>
        ); })}
      </div>
    </Page>
  );
}
