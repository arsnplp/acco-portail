import Link from "next/link";
import { redirect } from "next/navigation";
import { PartyPopperIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTeam } from "@/lib/auth";
import { STATUT, todayBounds } from "@/lib/crm";
import { readSession, sessionQuery, sessionWhere } from "@/lib/crm-session";

export const metadata = { title: "Session d’appels" };

/** Ouvre la fiche suivante de la colonne choisie (même ordre que le pipeline : relance la plus ancienne d'abord). */
export default async function SessionPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireTeam();
  const s = readSession(await searchParams);
  if (!s) redirect("/crm/pipeline");
  const next = await prisma.prospect.findFirst({
    where: sessionWhere(s, me.id, todayBounds().start),
    orderBy: [{ relanceAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    select: { id: true },
  });
  if (next) redirect(`/crm/prospects/${next.id}?${sessionQuery(s)}&session=1`);
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <PartyPopperIcon size={40} className="text-yellow" aria-hidden />
      <h1 className="mt-4 text-2xl">Session « {STATUT[s.statut].label} » terminée</h1>
      <p className="mt-2 text-sm text-text">Toutes les fiches de cette colonne ont été traitées aujourd’hui{s.skip.length ? ` (${s.skip.length} passée${s.skip.length > 1 ? "s" : ""})` : ""}.</p>
      <Link href="/crm/pipeline" className="mt-6 rounded-card bg-title px-4 py-2.5 text-sm font-semibold text-bg">Retour au pipeline</Link>
    </main>
  );
}
