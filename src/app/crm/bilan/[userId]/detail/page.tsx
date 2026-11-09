import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { PeriodeBilan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProspection } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ECHANGE, fmtDayTime, teamName } from "@/lib/crm";
import { INDICATEURS, PERIODES, bornes, cle, fmtVal, parseDebut, resultats, type Indicateur } from "@/lib/bilans";

export const metadata = { title: "Détail du bilan" };

/** Liste détaillée derrière un résultat du bilan : appels, RDV ou signatures du commercial sur la période, avec lien vers chaque fiche. */
export default async function DetailBilanPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ ind?: string; periode?: string; debut?: string }> }) {
  const me = await requireProspection();
  const { userId } = await params;
  if (userId !== me.id && !can(me, "pilotage")) redirect("/crm");
  const sp = await searchParams;
  const ind = (INDICATEURS.find((i) => i.key === sp.ind)?.key ?? "rdv") as Indicateur;
  const periode = (PERIODES.find((p) => p.key === sp.periode)?.key ?? "MENSUEL") as PeriodeBilan;
  const b = bornes(periode, parseDebut(sp.debut));
  const [u, res] = await Promise.all([prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, email: true } }), resultats(userId, b.debut, b.fin)]);
  if (!u) notFound();
  const def = INDICATEURS.find((i) => i.key === ind)!;
  const fiche = (p: { prospectId: string | null; clientId: string | null }) => (p.prospectId ? `/crm/prospects/${p.prospectId}` : p.clientId ? `/admin/clients/${p.clientId}` : null);
  return (
    <main className="mx-auto max-w-4xl px-4 py-6 lg:px-8 lg:py-8">
      <Link href={`/crm/bilan/${userId}?periode=${periode}&debut=${cle(b.debut)}`} className="text-sm text-text hover:text-title">← Bilan de {teamName(u)}</Link>
      <h1 className="mt-2 text-2xl">{def.label} · {fmtVal(ind, res.valeurs[ind])}</h1>
      <p className="mt-1 text-sm text-text">{b.label} · {def.aide}.</p>
      <div className="mt-4 flex flex-wrap gap-1.5">{INDICATEURS.map((i) => <Link key={i.key} href={`/crm/bilan/${userId}/detail?ind=${i.key}&periode=${periode}&debut=${cle(b.debut)}`} className={`rounded-full border px-3 py-1 text-xs ${i.key === ind ? "border-title bg-title font-semibold text-bg" : "border-border text-text hover:text-title"}`}>{i.label} · {fmtVal(i.key, res.valeurs[i.key])}</Link>)}</div>

      <ul className="mt-4 divide-y divide-border rounded-card border border-border bg-surface text-sm">
        {ind === "appels" && res.appels.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-20 shrink-0 text-xs font-semibold text-text-strong">{ECHANGE[e.type].short}</span>
            <div className="min-w-0 flex-1">{fiche(e) ? <Link href={fiche(e)!} className="font-semibold text-title hover:underline">{e.societe ?? e.clientNom ?? "Fiche"}</Link> : <span className="font-semibold text-title">{e.societe ?? e.clientNom ?? "—"}</span>}{e.notes && <p className="truncate text-xs text-text">{e.notes}</p>}</div>
            <span className="shrink-0 text-xs text-text">{fmtDayTime(e.date)}</span>
          </li>
        ))}
        {ind === "rdv" && res.rdv.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">{fiche(r) ? <Link href={fiche(r)!} className="font-semibold text-title hover:underline">{r.societe ?? r.clientNom ?? "Fiche"}</Link> : <span className="font-semibold text-title">{r.societe ?? r.clientNom ?? "—"}</span>}<p className="text-xs text-text">RDV le {fmtDayTime(r.debut)}{r.lieu ? ` · ${r.lieu}` : ""} · {r.resultat.toLowerCase()}</p></div>
          </li>
        ))}
        {(ind === "signatures" || ind === "ca") && res.signatures.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <Link href={`/crm/prospects/${s.id}`} className="font-semibold text-title hover:underline">{s.societe}</Link>
              <p className="text-xs text-text">{s.gagneAt ? `Gagné le ${fmtDayTime(s.gagneAt)}` : "Gagné"} · {s.mensuel} €/mois{s.creation ? ` + ${s.creation} € création` : ""} · CA 12 mois {s.ca.toLocaleString("fr-FR")} €{s.clientId && <> · <Link href={`/admin/clients/${s.clientId}`} className="text-green hover:underline">fiche client</Link></>}{s.contrats.map((c) => <span key={c.id}> · <Link href={`/admin/contrats/${c.id}`} className="hover:underline">{c.reference}</Link></span>)}</p>
            </div>
          </li>
        ))}
        {res.valeurs[ind] === 0 && <li className="px-4 py-3 text-text">Rien sur cette période.</li>}
      </ul>
    </main>
  );
}
