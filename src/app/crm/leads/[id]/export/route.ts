import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { COLONNES, ficheGoogle, type LeadRow } from "@/lib/leads/colonnes";

/** Export de la liste au format CSV (s'ouvre directement dans Excel). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role === "CLIENT") return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  const { id } = await params;
  const liste = await prisma.leadListe.findUnique({ where: { id }, include: { leads: { orderBy: { score: "desc" } } } });
  if (!liste) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  const cell = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [[...COLONNES, "Source"].join(";"), ...liste.leads.map((l) => { const d = l.donnees as LeadRow; return [...COLONNES.map((c) => cell(c === "Fiche Google" ? ficheGoogle(d)?.url : d[c])), cell(d._source)].join(";"); })];
  const name = `Leads_${liste.secteur}_${liste.region}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 80);
  return new NextResponse("﻿" + lines.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });
}
