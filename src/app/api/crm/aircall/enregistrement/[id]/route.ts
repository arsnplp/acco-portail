import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAircallMeta, recordingUrl } from "@/lib/aircall";

/** Écoute d'un enregistrement Aircall : on demande un lien frais (ils expirent) et on redirige dessus. Équipe uniquement. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role === "CLIENT") return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  const { id } = await params;
  const e = await prisma.echange.findUnique({ where: { id }, select: { meta: true } });
  if (!e || !isAircallMeta(e.meta)) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  try {
    const url = await recordingUrl(e.meta.aircallId);
    if (!url) return NextResponse.json({ error: "Pas d’enregistrement pour cet appel." }, { status: 404 });
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
