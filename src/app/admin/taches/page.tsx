import Link from "next/link";
import { ListChecksIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { estExterne } from "@/lib/permissions";
import { whereClientsPour } from "@/lib/perimetre";
import { AdminPage } from "@/components/admin/page";
import { MultiSelect } from "@/components/ui/multi-select";
import { multi } from "@/lib/filtres";
import { Badge } from "@/components/ui/badge";
import { LogoClient } from "@/components/ui/logo-client";
import { fmtDate } from "@/lib/format";
import { teamName } from "@/lib/crm";
import { MODULES } from "@/lib/roles";
import { cn } from "@/lib/cn";
import { NouvelleTacheForm, TacheRowActions } from "./liste";

export const metadata = { title: "Tâches" };
const TYPE_LABEL: Record<string, string> = { RELANCE: "Relance", RDV_A_PLANIFIER: "RDV à planifier", APPEL: "Appel", EMAIL: "Email", DOCUMENT: "Document", MAINTENANCE: "Maintenance", AUTRE: "Autre" };
type SP = { vue?: string; qui?: string; client?: string; type?: string; statut?: string; echeance?: string; site?: string };

/** Gestionnaire centralisé des tâches commerciales et de suivi (section 7) : mes tâches / équipe, filtres, réattribution, historique. */
export default async function TachesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireTeam();
  const sp = await searchParams;
  const vue = sp.vue === "equipe" ? "equipe" : "moi";
  const STATUTS = ["A_FAIRE", "FAIT", "ANNULEE"] as const;
  type St = (typeof STATUTS)[number];
  // Choix multiples : statuts (« À faire » par défaut, « tous » = aucun filtre), collaborateurs, clients, types.
  const statuts: St[] = sp.statut === "tous" ? [] : (multi(sp.statut).filter((x) => (STATUTS as readonly string[]).includes(x)) as St[]);
  if (sp.statut === undefined) statuts.push("A_FAIRE"); // arrivée sans filtre : « À faire » ; tout décoché = tous les statuts
  const fqui = multi(sp.qui), fclient = multi(sp.client), ftype = multi(sp.type).filter((x) => x in TYPE_LABEL);
  const now = new Date();
  const [taches, equipe, clients] = await Promise.all([
    prisma.tacheClient.findMany({
      where: { ...(vue === "moi" ? { responsableId: me.id } : fqui.length ? { responsableId: { in: fqui } } : {}), ...(statuts.length && { statut: { in: statuts } }), ...(fclient.length && { clientId: { in: fclient } }), ...(sp.site && { siteId: sp.site }), ...(ftype.length && { type: { in: ftype as never[] } }), ...(sp.echeance === "retard" && { echeance: { lt: now } }), ...(sp.echeance === "semaine" && { echeance: { lte: new Date(now.getTime() + 7 * 86400_000) } }), ...(sp.echeance === "sans" && { echeance: null }), client: whereClientsPour(me) },
      orderBy: [{ echeance: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }], take: 300,
      include: { client: { select: { id: true, name: true, logoMiniPath: true } }, site: { select: { id: true, name: true } }, responsable: { select: { firstName: true, email: true } } },
    }),
    prisma.user.findMany({ where: { role: { in: MODULES.suivi } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true } }),
    prisma.client.findMany({ where: { archivedAt: null, ...whereClientsPour(me) }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const membres = equipe.map((u) => ({ id: u.id, name: teamName(u) }));
  const href = (patch: Partial<SP>) => `/admin/taches?${new URLSearchParams(Object.fromEntries(Object.entries({ ...sp, ...patch }).filter(([, v]) => v)) as Record<string, string>)}`;
  const sel = "h-9 appearance-none rounded-full border border-border bg-surface px-3 text-xs text-title outline-none hover:border-text";
  const enRetard = taches.filter((t) => t.statut === "A_FAIRE" && t.echeance && t.echeance < now).length;
  return (
    <AdminPage title="Tâches" wide>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-border p-0.5 text-sm"><Link href={href({ vue: "moi", qui: "" })} className={cn("rounded-full px-3 py-1.5", vue === "moi" ? "bg-title font-semibold text-bg" : "text-text hover:text-title")}>Mes tâches</Link><Link href={href({ vue: "equipe" })} className={cn("rounded-full px-3 py-1.5", vue === "equipe" ? "bg-title font-semibold text-bg" : "text-text hover:text-title")}>Équipe</Link></div>
        <form method="get" action="/admin/taches" className="flex flex-1 flex-wrap items-center gap-2">
          <input type="hidden" name="vue" value={vue} />
          {vue === "equipe" && <MultiSelect name="qui" label="Toute l’équipe" defaultValue={fqui} options={membres.map((m) => ({ value: m.id, label: m.name }))} />}
          <MultiSelect name="client" label="Tous les clients" defaultValue={fclient} options={clients.map((c) => ({ value: c.id, label: c.name }))} />
          <MultiSelect name="type" label="Tous les types" defaultValue={ftype} options={Object.entries(TYPE_LABEL).map(([k, l]) => ({ value: k, label: l }))} />
          <MultiSelect name="statut" label="Tous les statuts" defaultValue={statuts} options={[{ value: "A_FAIRE", label: "À faire" }, { value: "FAIT", label: "Faites" }, { value: "ANNULEE", label: "Annulées" }]} />
          <select name="echeance" defaultValue={sp.echeance ?? ""} className={sel} aria-label="Échéance"><option value="">Toute échéance</option><option value="retard">En retard</option><option value="semaine">Sous 7 jours</option><option value="sans">Sans échéance</option></select>
          <button type="submit" className="h-9 rounded-full border border-border px-3 text-xs text-text hover:text-title">Filtrer</button>
        </form>
      </div>
      <p className="mb-3 text-sm text-text">{taches.length} tâche{taches.length > 1 ? "s" : ""}{enRetard ? <> · <span className="font-semibold text-pink">{enRetard} en retard</span></> : ""}</p>
      {taches.length === 0 ? <p className="rounded-card border border-border bg-surface px-4 py-6 text-center text-sm text-text"><ListChecksIcon size={20} className="mx-auto mb-2 text-muted" aria-hidden />Rien à afficher avec ces filtres.</p> : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {taches.map((t) => {
            const retard = t.statut === "A_FAIRE" && t.echeance && t.echeance < now;
            return (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <LogoClient id={t.client.id} name={t.client.name} logo={t.client.logoMiniPath} size={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-title">{t.titre} <Badge tone="neutral">{TYPE_LABEL[t.type]}</Badge>{t.statut !== "A_FAIRE" && <Badge tone={t.statut === "FAIT" ? "green" : "neutral"} className="ml-1">{t.statut === "FAIT" ? "Faite" : "Annulée"}</Badge>}</p>
                  <p className={cn("truncate text-xs", retard ? "text-pink" : "text-text")}><Link href={`/admin/clients/${t.client.id}?onglet=taches`} className="hover:underline">{t.client.name}</Link>{t.site ? ` · ${t.site.name}` : ""} · {t.echeance ? `${retard ? "en retard · " : ""}${fmtDate(t.echeance)}` : "sans échéance"} · {t.responsable ? teamName(t.responsable) : "sans responsable"}{t.source ? ` · origine : ${t.source}` : ""}{t.description ? ` · ${t.description}` : ""}</p>
                </div>
                {t.statut === "A_FAIRE" && <TacheRowActions id={t.id} responsableId={t.responsableId} membres={membres} echeance={t.echeance ? t.echeance.toLocaleDateString("en-CA", { timeZone: "Europe/Paris" }) : ""} />}
              </li>
            );
          })}
        </ul>
      )}
      {!estExterne(me) && <div className="mt-4"><NouvelleTacheForm membres={membres} clients={clients} meId={me.id} /></div>}
    </AdminPage>
  );
}
