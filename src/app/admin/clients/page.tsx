import Link from "next/link";
import { Plus, SearchIcon, StarIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { AdminPage } from "@/components/admin/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FORMULE, SITE_STATUS } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { derniersContacts, JOURS_SANS_CONTACT } from "@/lib/alertes";
import { MODULES } from "@/lib/roles";
import { matchRecherche, teamName, todayBounds } from "@/lib/crm";

export const metadata = { title: "Clients" };

type SP = { vue?: string; q?: string; c?: string };

/**
 * Clients : « Mes clients » (portefeuille du commercial ou projets du développeur) et « Tous les clients ».
 * Les clients références sont épinglés en tête ; un client sans contact depuis plus de 60 jours est signalé.
 */
export default async function ClientsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireTeam();
  const sp = await searchParams;
  const vue = sp.vue === "tous" ? "tous" : sp.vue === "me" ? "me" : me.role === "ADMIN" ? "tous" : "me";
  const q = (sp.q ?? "").trim();
  const who = sp.c && sp.c !== "all" ? sp.c : null;
  const [clients, equipe] = await Promise.all([
    prisma.client.findMany({
      where: vue === "me" ? { OR: [{ commercialId: me.id }, { developpeurId: me.id }, { sites: { some: { developpeurId: me.id } } }] } : who ? { commercialId: who } : {},
      orderBy: [{ reference: "desc" }, { createdAt: "desc" }],
      include: { sites: { select: { id: true, name: true, status: true } }, memberships: { include: { user: true } }, commercial: { select: { firstName: true, email: true } }, crmProspect: { select: { telephone: true } } },
    }),
    prisma.user.findMany({ where: { role: { in: MODULES.prospection } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true } }),
  ]);
  const contacts = await derniersContacts(clients.map((c) => c.id));
  const { end } = todayBounds();
  const jours = (c: (typeof clients)[number]) => { const d = contacts.get(c.id) ?? c.createdAt; return Math.floor((end.getTime() - d.getTime()) / 86400_000); };
  const visibles = clients.filter((c) => matchRecherche(q, [c.name, c.email, c.memberships.map((m) => `${m.user.firstName ?? ""} ${m.user.lastName ?? ""} ${m.user.email}`).join(" ")], [c.phone, c.crmProspect?.telephone]));
  const sansContact = visibles.filter((c) => jours(c) >= JOURS_SANS_CONTACT).length;
  const href = (patch: Partial<SP>) => `/admin/clients?${new URLSearchParams(Object.fromEntries(Object.entries({ vue, q, c: who ?? "", ...patch }).filter(([, v]) => v)))}`;
  const sel = "h-10 appearance-none rounded-full border border-border bg-surface px-3 text-sm text-title outline-none hover:border-text";

  return (
    <AdminPage title="Clients" action={<Button href="/admin/clients/nouveau" size="sm"><Plus size={16} /> Nouveau client</Button>}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-border p-0.5 text-sm">
          <Link href={href({ vue: "me" })} className={cn("rounded-full px-3 py-1.5", vue === "me" ? "bg-title font-semibold text-bg" : "text-text hover:text-title")}>Mes clients</Link>
          <Link href={href({ vue: "tous" })} className={cn("rounded-full px-3 py-1.5", vue === "tous" ? "bg-title font-semibold text-bg" : "text-text hover:text-title")}>Tous les clients</Link>
        </div>
        <form method="get" action="/admin/clients" className="flex flex-1 flex-wrap items-center gap-2">
          <input type="hidden" name="vue" value={vue} />
          <label className="relative min-w-40 flex-1">
            <SearchIcon size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
            <input name="q" defaultValue={q} placeholder="Nom, gérant, email, téléphone" className="h-10 w-full rounded-full border border-border bg-surface pr-3 pl-9 text-sm text-title placeholder:text-muted outline-none focus:border-blue" />
          </label>
          {vue === "tous" && (
            <select name="c" defaultValue={who ?? "all"} aria-label="Commercial" className={sel}>
              <option value="all">Tous les commerciaux</option>{equipe.map((u) => <option key={u.id} value={u.id}>{teamName(u)}</option>)}
            </select>
          )}
          <button type="submit" className="h-10 rounded-full border border-border px-4 text-sm text-text hover:text-title">Filtrer</button>
        </form>
      </div>
      <p className="mb-3 text-sm text-text">{visibles.length} client{visibles.length > 1 ? "s" : ""}{sansContact ? <> · <span className="font-semibold text-pink">{sansContact} sans contact depuis plus de {JOURS_SANS_CONTACT} jours</span></> : ""}{vue === "tous" ? " · les clients références sont en tête" : ""}</p>

      <div className="grid gap-2">
        {visibles.map((c) => {
          const owner = c.memberships.find((m) => m.role === "OWNER")?.user;
          const j = jours(c);
          return (
            <Card key={c.id} href={`/admin/clients/${c.id}`} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-semibold text-title">{c.reference && <StarIcon size={13} className="shrink-0 fill-yellow text-yellow" aria-label="Client référence" />}{c.name}{c.formule && <Badge tone={FORMULE[c.formule].tone} className="ml-1">{FORMULE[c.formule].label}</Badge>}</p>
                  <p className="text-xs text-text">{[owner ? `${owner.firstName ?? ""} ${owner.lastName ?? ""} · ${owner.email}`.trim() : "Aucun gérant", c.commercial ? `suivi par ${c.commercial.firstName ?? c.commercial.email}` : null].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <div className="flex items-center gap-1">
                    {c.sites[0] && <Badge tone={SITE_STATUS[c.sites[0].status].tone} className="max-w-[40vw] sm:max-w-xs">{c.sites[0].name}</Badge>}
                    {c.sites.length > 1 && <Badge tone="neutral">+{c.sites.length - 1}</Badge>}
                    {c.sites.length === 0 && <Badge tone="neutral">Aucun site</Badge>}
                  </div>
                  <span className={cn("text-[11px]", j >= JOURS_SANS_CONTACT ? "font-semibold text-pink" : "text-text")}>{contacts.get(c.id) ? `contact il y a ${j} j` : `aucun contact · client depuis ${j} j`}</span>
                </div>
              </div>
            </Card>
          );
        })}
        {visibles.length === 0 && <p className="text-text">{vue === "me" ? "Aucun client ne vous est attribué pour l’instant (« Suivi par » ou développeur sur la fiche client)." : "Aucun client."}</p>}
      </div>
    </AdminPage>
  );
}
