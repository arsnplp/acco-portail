import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { can, estExterne } from "@/lib/permissions";
import { whereClientsPour } from "@/lib/perimetre";
import { derniersContacts } from "@/lib/alertes";

/** Export CSV du tableau clients (3.2) : sélection ou tout, au périmètre et aux droits (montants seulement avec finance). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role === "CLIENT" || estExterne(user)) return new NextResponse(null, { status: 403 });
  const ids = new URL(req.url).searchParams.get("ids")?.split(",").filter(Boolean);
  const clients = await prisma.client.findMany({ where: { ...(ids?.length ? { id: { in: ids } } : { archivedAt: null }), ...whereClientsPour(user) }, orderBy: { name: "asc" }, include: { commercial: { select: { firstName: true, email: true } }, sites: { select: { name: true, status: true } }, contrats: { where: { statut: "SIGNE" }, select: { montantMensuelHt: true, finEngagement: true } }, contacts: { where: { principal: true }, take: 1 } } });
  const contacts = await derniersContacts(clients.map((c) => c.id));
  const finance = can(user, "finance");
  const q = (v: unknown) => { const s = String(v ?? "").replace(/"/g, '""'); return `"${/^[=+\-@]/.test(s) ? `'${s}` : s}"`; };
  const head = ["Client", "Secteur", "Référent", "Formule", "Sites", "Contact principal", "Email", "Téléphone", "Dernier contact", "Fin d’engagement", ...(finance ? ["Mensuel HT"] : [])];
  const rows = clients.map((c) => [c.name, c.secteur, c.commercial ? c.commercial.firstName ?? c.commercial.email : "", c.formule ?? "", c.sites.map((s) => `${s.name} (${s.status})`).join(" | "), [c.contacts[0]?.prenom, c.contacts[0]?.nom].filter(Boolean).join(" "), c.contacts[0]?.email ?? c.email ?? "", c.contacts[0]?.telephone ?? c.phone ?? "", contacts.get(c.id)?.toISOString().slice(0, 10) ?? "", c.contrats.map((x) => x.finEngagement?.toISOString().slice(0, 10) ?? "").filter(Boolean).join(" | "), ...(finance ? [(c.contrats.reduce((a, x) => a + x.montantMensuelHt, 0) / 100).toFixed(2)] : [])].map(q).join(";"));
  const csv = "﻿" + [head.map(q).join(";"), ...rows].join("\r\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="clients-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
