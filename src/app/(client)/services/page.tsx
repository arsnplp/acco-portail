/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Globe, LockIcon, MapPinIcon, MegaphoneIcon, WrenchIcon, type LucideIcon } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";
import { fmtDate } from "@/lib/format";
import { SERVICES, servicesSouscrits, type ServiceKey } from "@/lib/services-client";
import { demanderService } from "./actions";

export const metadata = { title: "Mes services" };
const ICONE: Record<ServiceKey, LucideIcon> = { site: Globe, google: MapPinIcon, ads: MegaphoneIcon };

/** Mes services : une barre Site / Fiche Google / Publicité. Site = choix du site ; les autres : interface si souscrit, sinon cadenas, trois lignes et un bouton. */
export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { client } = await requireClientContext();
  const sp = await searchParams;
  const v: ServiceKey = sp.v === "google" || sp.v === "ads" ? sp.v : "site";
  const ok = await servicesSouscrits(client.id);
  return (
    <Page title="Mes services">
      <div className="-mt-2 mb-4 flex gap-1 rounded-full border border-border p-1">
        {(Object.keys(SERVICES) as ServiceKey[]).map((k) => { const I = ICONE[k]; const on = v === k; return <Link key={k} href={k === "site" ? "/services" : `/services?v=${k}`} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium transition-colors", on ? "bg-title text-bg" : "text-text hover:text-title")}><I size={15} aria-hidden /> {SERVICES[k].label}{!ok[k] && k !== "site" && <LockIcon size={11} className={on ? "opacity-70" : "text-muted"} aria-label="Non inclus" />}</Link>; })}
      </div>
      {v === "site" ? <Sites clientId={client.id} /> : ok[v] ? <EnPreparation k={v} /> : <Verrou k={v} clientId={client.id} />}
    </Page>
  );
}

async function Sites({ clientId }: { clientId: string }) {
  const sites = await prisma.site.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } });
  return (
    <div className="grid gap-3">
      {sites.map((s) => (
        <Card key={s.id} href={`/sites/${s.id}`} className="overflow-hidden p-0">
          <div className="flex aspect-[16/9] items-center justify-center border-b border-border bg-surface-2">{s.screenshotUrl ? <img src={s.screenshotUrl} alt="" className="size-full object-cover" /> : <Globe className="text-muted" size={32} strokeWidth={1.25} />}</div>
          <div className="flex items-center justify-between p-4"><div><p className="font-semibold text-title">{s.name}</p><p className="text-sm text-text">{s.url ?? (s.maquetteEnvoyeeAt ? s.previewUrl : null) ?? "En préparation"}</p></div>{s.status === "EN_LIGNE" ? <Badge tone="green">En ligne</Badge> : <Badge tone="yellow">En création</Badge>}</div>
        </Card>
      ))}
      {sites.length === 0 && <Empty icon={Globe} title="Aucun site pour le moment" text="Votre site apparaîtra ici dès le lancement du projet." />}
    </div>
  );
}

function EnPreparation({ k }: { k: ServiceKey }) {
  const I = ICONE[k];
  return <Empty icon={I} title={`${SERVICES[k].court} : inclus`} text="Le suivi de ce service arrive bientôt dans votre espace. En attendant, votre équipe ACCO vous tient au courant dans Messages." action={<Link href="/messages" className="inline-flex h-9 items-center rounded-card border border-border px-3 text-sm text-title hover:border-text"><WrenchIcon size={14} className="mr-1.5" /> Écrire à l’équipe</Link>} />;
}

async function Verrou({ k, clientId }: { k: ServiceKey; clientId: string }) {
  const s = SERVICES[k];
  const I = ICONE[k];
  const demande = await prisma.activite.findFirst({ where: { clientId, kind: s.kind }, select: { createdAt: true } });
  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-full border border-border text-text"><I size={18} /></span><span className="flex size-7 items-center justify-center rounded-full bg-surface-2 text-text"><LockIcon size={13} /></span></div>
      <h2 className="mt-3 text-lg font-semibold text-title">{s.court}</h2>
      <p className="mt-1 text-sm leading-relaxed text-text-strong">{s.benef}</p>
      {demande ? (
        <p className="mt-4 rounded-lg border border-green/40 bg-green/10 p-3 text-sm text-green">Demande envoyée le {fmtDate(demande.createdAt)}. On revient vers vous très vite dans Messages.</p>
      ) : (
        <form action={demanderService.bind(null, k)} className="mt-4"><SubmitButton className="w-full" pendingLabel="Envoi…">{s.cta}</SubmitButton><p className="mt-2 text-center text-xs text-text">Sans engagement : on vous explique le fonctionnement et le tarif, vous décidez ensuite.</p></form>
      )}
    </div>
  );
}
