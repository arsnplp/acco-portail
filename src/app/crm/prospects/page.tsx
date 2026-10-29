import Link from "next/link";
import type { Prisma, ProspectStatut } from "@prisma/client";
import { FilterIcon, SearchIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { isAircallMeta } from "@/lib/aircall";
import { CLOS, MOTIFS_ABANDON, MOTIFS_PERTE, PIPELINE, SEQUENCE_APPELS, STATUT, TOUS_STATUTS, contactName, formatTel, teamName, todayBounds } from "@/lib/crm";
import { Liste, type Row } from "./liste";

export const metadata = { title: "Tous les prospects" };

type SP = { q?: string; s?: string; c?: string; cible?: string; appels?: string; motif?: string; rec?: string; notes?: string; j?: string; p?: string };
const PAGE = 100;
const APPELS_TYPES = ["NRP", "APPEL", "PRISE_RDV"] as const;

/**
 * Vue « Tous les prospects » : toutes les fiches (ouvertes, gagnées, perdues, abandonnées) avec des filtres avancés
 * (repêcher un abandon, vérifier la séquence d'appels, relire les notes des non intéressés, réécouter les appels Aircall)
 * et des actions en masse (statut, relance, réattribution).
 */
export default async function ProspectsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireTeam();
  const sp = await searchParams;
  const isAdmin = me.role === "ADMIN";
  const q = (sp.q ?? "").trim();
  const s = sp.s ?? "";
  const statutFiltre: ProspectStatut | null = TOUS_STATUTS.includes(s as ProspectStatut) ? (s as ProspectStatut) : null;
  const jours = ["7", "30", "90", "365"].includes(sp.j ?? "") ? Number(sp.j) : null;
  const page = Math.max(1, Number(sp.p) || 1);
  const { end } = todayBounds();

  const where: Prisma.ProspectWhereInput = {
    ...(statutFiltre ? { statut: statutFiltre } : s === "ouverts" ? { statut: { in: PIPELINE } } : s === "clos" ? { statut: { in: CLOS } } : {}),
    ...(sp.c === "me" ? { commercialId: me.id } : sp.c === "none" ? { commercialId: null } : sp.c && sp.c !== "all" ? { commercialId: sp.c } : {}),
    ...(sp.cible ? { cible: { nom: sp.cible } } : {}),
    ...(sp.motif ? { motifPerte: sp.motif } : {}),
    ...(jours ? { updatedAt: { gte: new Date(end.getTime() - (jours + 1) * 86400_000) } } : {}),
    ...(sp.rec === "1" ? { echanges: { some: { meta: { path: ["enregistrement"], equals: true } } } } : {}),
    ...(sp.notes === "1" ? { echanges: { some: { origine: { in: ["saisie", "import"] }, type: { not: "NRP" }, notes: { not: null } } } } : {}),
    ...(q ? {
      OR: [
        { societe: { contains: q, mode: "insensitive" } },
        { dirigeant: { contains: q, mode: "insensitive" } },
        { contacts: { some: { OR: [{ prenom: { contains: q, mode: "insensitive" } }, { nom: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } } },
        ...(formatTel(q) && /\d{4,}/.test(q.replace(/\D/g, "")) ? [{ telephone: { contains: formatTel(q)! } }, { contacts: { some: { telephone: { contains: formatTel(q)! } } } }] : []),
      ],
    } : {}),
  };

  const [team, cibles, all] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ["ADMIN", "COMMERCIAL"] } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true } }),
    prisma.cible.findMany({ orderBy: { nom: "asc" }, select: { nom: true } }),
    prisma.prospect.findMany({
      where, orderBy: { updatedAt: "desc" },
      select: {
        id: true, societe: true, statut: true, relanceAt: true, rappelAt: true, telephone: true, siteWeb: true, commercialId: true, motifPerte: true, updatedAt: true, clientId: true,
        cible: { select: { nom: true } },
        contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }], take: 1, select: { prenom: true, nom: true, telephone: true } },
        _count: { select: { echanges: { where: { type: { in: [...APPELS_TYPES] } } } } },
        echanges: { orderBy: { date: "desc" }, take: 3, select: { id: true, type: true, date: true, notes: true, origine: true, meta: true, auteur: { select: { firstName: true, email: true } }, auteurNom: true } },
      },
    }),
  ]);
  // Séquence d'appels : filtre en mémoire (compte des NRP + appels + prises de RDV).
  const filtres = all.filter((p) => {
    const n = p._count.echanges;
    return sp.appels === "0" ? n === 0 : sp.appels === "enc" ? n > 0 && n < SEQUENCE_APPELS : sp.appels === "fait" ? n >= SEQUENCE_APPELS : true;
  });
  const total = filtres.length;
  const slice = filtres.slice((page - 1) * PAGE, page * PAGE);
  // Enregistrements Aircall des fiches affichées (pour les réécouter sans ouvrir la fiche).
  const recs = slice.length ? await prisma.echange.findMany({
    where: { prospectId: { in: slice.map((p) => p.id) }, meta: { path: ["enregistrement"], equals: true } },
    orderBy: { date: "desc" }, select: { id: true, prospectId: true, date: true, meta: true },
  }) : [];
  const recsBy = new Map<string, Row["enregistrements"]>();
  for (const r of recs) {
    if (!isAircallMeta(r.meta) || !r.prospectId) continue;
    recsBy.set(r.prospectId, [...(recsBy.get(r.prospectId) ?? []), { id: r.id, date: r.date.toISOString(), meta: r.meta }]);
  }

  const rows: Row[] = slice.map((p) => ({
    id: p.id, societe: p.societe, contact: contactName(p.contacts[0]), telephone: formatTel(p.contacts[0]?.telephone ?? p.telephone), siteWeb: p.siteWeb, statut: p.statut,
    relanceAt: p.relanceAt?.toISOString() ?? null, rappelAt: p.rappelAt?.toISOString() ?? null, commercialId: p.commercialId, cible: p.cible?.nom ?? null, motif: p.motifPerte,
    appels: p._count.echanges, updatedAt: p.updatedAt.toISOString(), client: !!p.clientId,
    derniers: p.echanges.map((e) => ({ id: e.id, type: e.type, date: e.date.toISOString(), notes: e.notes, origine: e.origine, auteur: e.auteur ? teamName(e.auteur) : e.auteurNom, meta: e.meta })),
    enregistrements: recsBy.get(p.id) ?? [],
  }));

  const href = (patch: Partial<SP>) => {
    const base: Record<string, string> = { q, s, c: sp.c ?? "all", cible: sp.cible ?? "", appels: sp.appels ?? "", motif: sp.motif ?? "", rec: sp.rec ?? "", notes: sp.notes ?? "", j: sp.j ?? "", ...patch } as Record<string, string>;
    return `/crm/prospects?${new URLSearchParams(Object.fromEntries(Object.entries(base).filter(([k, v]) => v && !(k === "c" && v === "all"))))}`;
  };
  const sel = "h-10 w-full appearance-none rounded-full border border-border bg-surface px-3 text-sm text-title outline-none hover:border-text";
  const raccourcis: { label: string; patch: Partial<SP>; hint: string }[] = [
    { label: "Abandons à repêcher", patch: { s: "ABANDON" }, hint: "fiches écartées par erreur ?" },
    { label: "Séquence incomplète", patch: { s: "ouverts", appels: "enc" }, hint: `moins de ${SEQUENCE_APPELS} appels` },
    { label: "Pas intéressés", patch: { s: "PERDU", motif: "Pas intéressé", notes: "1" }, hint: "relire les notes, analyser les refus" },
    { label: "Avec enregistrement", patch: { rec: "1" }, hint: "réécouter les appels Aircall" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl">Tous les prospects</h1>
          <p className="mt-1 text-sm text-text">{total} fiche{total > 1 ? "s" : ""}{total !== all.length ? ` (sur ${all.length})` : ""} · cochez-en plusieurs pour changer le statut, la relance ou le commercial d’un coup.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {raccourcis.map((r) => <Link key={r.label} href={href({ q: "", s: "", c: "all", cible: "", appels: "", motif: "", rec: "", notes: "", j: "", ...r.patch })} title={r.hint} className="rounded-full border border-border px-3 py-1 text-xs text-text hover:border-text hover:text-title">{r.label}</Link>)}
        </div>
      </div>

      <form method="get" action="/crm/prospects" className="mt-4 grid gap-2 rounded-card border border-border bg-surface p-3 sm:grid-cols-3 lg:grid-cols-5">
        <label className="relative sm:col-span-3 lg:col-span-2">
          <SearchIcon size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Société, contact, email, téléphone" className="h-10 w-full rounded-full border border-border bg-surface pr-3 pl-9 text-sm text-title placeholder:text-muted outline-none focus:border-blue" />
        </label>
        <select name="s" defaultValue={s} aria-label="Statut" className={sel}>
          <option value="">Tous les statuts</option><option value="ouverts">Ouverts (pipeline)</option><option value="clos">Clos (gagné, perdu, abandon)</option>
          {TOUS_STATUTS.map((x) => <option key={x} value={x}>{STATUT[x].label}</option>)}
        </select>
        <select name="c" defaultValue={sp.c ?? "all"} aria-label="Commercial" className={sel}>
          <option value="all">Tous les commerciaux</option><option value="me">Moi</option>
          {team.filter((u) => u.id !== me.id).map((u) => <option key={u.id} value={u.id}>{teamName(u)}</option>)}
          <option value="none">Sans commercial</option>
        </select>
        <select name="cible" defaultValue={sp.cible ?? ""} aria-label="Cible" className={sel}><option value="">Toutes cibles</option>{cibles.map((c) => <option key={c.nom}>{c.nom}</option>)}</select>
        <select name="appels" defaultValue={sp.appels ?? ""} aria-label="Séquence d’appels" className={sel}>
          <option value="">Appels : peu importe</option><option value="0">Jamais appelé</option><option value="enc">Séquence incomplète (1 à {SEQUENCE_APPELS - 1} appels)</option><option value="fait">Séquence faite ({SEQUENCE_APPELS} appels et plus)</option>
        </select>
        <select name="motif" defaultValue={sp.motif ?? ""} aria-label="Motif" className={sel}>
          <option value="">Tous motifs</option>
          <optgroup label="Perte">{MOTIFS_PERTE.map((m) => <option key={m}>{m}</option>)}</optgroup>
          <optgroup label="Abandon">{MOTIFS_ABANDON.filter((m) => !MOTIFS_PERTE.includes(m)).map((m) => <option key={m}>{m}</option>)}</optgroup>
        </select>
        <select name="j" defaultValue={sp.j ?? ""} aria-label="Période" className={sel}>
          <option value="">Modifiés : toujours</option><option value="7">Modifiés depuis 7 jours</option><option value="30">30 jours</option><option value="90">3 mois</option><option value="365">12 mois</option>
        </select>
        <label className="flex h-10 items-center gap-2 px-1 text-sm text-text-strong"><input type="checkbox" name="rec" value="1" defaultChecked={sp.rec === "1"} className="size-4 accent-white" /> Avec enregistrement</label>
        <label className="flex h-10 items-center gap-2 px-1 text-sm text-text-strong"><input type="checkbox" name="notes" value="1" defaultChecked={sp.notes === "1"} className="size-4 accent-white" /> Avec notes écrites</label>
        <div className="flex gap-2 sm:col-span-3 lg:col-span-1 lg:justify-end">
          <button type="submit" className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-title px-4 text-sm font-semibold text-bg lg:flex-none"><FilterIcon size={14} aria-hidden /> Filtrer</button>
          <Link href="/crm/prospects" className="flex h-10 items-center rounded-full border border-border px-4 text-sm text-text hover:text-title">Effacer</Link>
        </div>
      </form>

      <Liste rows={rows} team={team.map((u) => ({ id: u.id, name: teamName(u) }))} isAdmin={isAdmin} />

      {total > PAGE && (
        <div className="mt-4 flex items-center justify-between text-sm text-text">
          <span>Page {page} / {Math.ceil(total / PAGE)}</span>
          <span className="flex gap-2">
            {page > 1 && <Link href={href({ p: String(page - 1) } as Partial<SP>)} className="rounded-full border border-border px-3 py-1 hover:text-title">Précédente</Link>}
            {page * PAGE < total && <Link href={href({ p: String(page + 1) } as Partial<SP>)} className="rounded-full border border-border px-3 py-1 hover:text-title">Suivante</Link>}
          </span>
        </div>
      )}
    </main>
  );
}
