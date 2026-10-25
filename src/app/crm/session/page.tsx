import Link from "next/link";
import { redirect } from "next/navigation";
import { PartyPopperIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { PIPELINE, todayBounds } from "@/lib/crm";

export const metadata = { title: "Session d’appels" };

/** Ouvre la prochaine fiche à appeler (mes relances du jour et en retard, pas encore traitées aujourd'hui). */
export default async function SessionPage({ searchParams }: { searchParams: Promise<{ skip?: string }> }) {
  const me = await requireTeam();
  const { skip } = await searchParams;
  const skipped = skip?.split(",").filter(Boolean) ?? [];
  const { start, end } = todayBounds();
  const next = await prisma.prospect.findFirst({
    where: {
      commercialId: me.id, statut: { in: PIPELINE }, relanceAt: { lt: end }, id: { notIn: skipped },
      echanges: { none: { auteurId: me.id, date: { gte: start } } },
    },
    orderBy: { relanceAt: "asc" },
    select: { id: true },
  });
  if (next) redirect(`/crm/prospects/${next.id}?session=1${skipped.length ? `&skip=${skipped.join(",")}` : ""}`);
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <PartyPopperIcon size={40} className="text-yellow" aria-hidden />
      <h1 className="mt-4 text-2xl">Session terminée</h1>
      <p className="mt-2 text-sm text-text">Plus aucune relance prévue pour aujourd’hui{skipped.length ? ` (${skipped.length} fiche${skipped.length > 1 ? "s" : ""} passée${skipped.length > 1 ? "s" : ""})` : ""}.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/crm" className="rounded-card bg-title px-4 py-2.5 text-sm font-semibold text-bg">Ma journée</Link>
        <Link href="/crm/pipeline" className="rounded-card border border-border px-4 py-2.5 text-sm text-title">Pipeline</Link>
      </div>
    </main>
  );
}
