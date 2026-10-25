import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contactName } from "@/lib/crm";

/** Mes rappels arrivés (ou dans la minute) des 6 dernières heures : affichés en bandeau dans l'espace Commercial. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role === "CLIENT") return NextResponse.json({ rappels: [] }, { status: 401 });
  const now = Date.now();
  const rows = await prisma.prospect.findMany({
    where: { commercialId: user.id, rappelAt: { gte: new Date(now - 6 * 3600_000), lte: new Date(now + 60_000) } },
    orderBy: { rappelAt: "asc" },
    select: { id: true, societe: true, rappelAt: true, telephone: true, contacts: { orderBy: [{ principal: "desc" }, { createdAt: "asc" }], take: 1, select: { prenom: true, nom: true, telephone: true } } },
  });
  return NextResponse.json({
    rappels: rows.map((p) => ({ id: p.id, at: p.rappelAt!.toISOString(), nom: contactName(p.contacts[0]) ?? p.societe, societe: p.societe, telephone: p.contacts[0]?.telephone ?? p.telephone })),
  });
}
