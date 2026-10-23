import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyAdmins, excerpt } from "@/lib/notify";

/** Appelée par scripts/nouvelle-demande.mts : prévient l'équipe comme si le client avait envoyé la demande. */
export async function POST(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  const cr = id ? await prisma.changeRequest.findUnique({ where: { id }, include: { site: { include: { client: true } } } }) : null;
  if (!cr) return NextResponse.json({ error: "demande introuvable" }, { status: 404 });
  await notifyAdmins({
    pref: "changes", tag: `modif-${cr.id}`, href: "/admin/modifications",
    title: `${cr.urgency === "URGENTE" ? "🔴 Demande urgente" : "Nouvelle demande de modif"} · ${cr.site.name}`,
    body: `${cr.site.client.name} : ${excerpt(cr.title)}`,
  });
  return NextResponse.json({ ok: true });
}
