import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyTurnstile, rateLimit, CORS_HEADERS } from "@/lib/forms";
import { notifyClient } from "@/lib/notify";
import { layout, appUrl } from "@/lib/email";

const schema = z.object({
  name: z.string({ error: "nom requis" }).trim().min(1, "nom requis").max(120),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  type: z.string().trim().max(60).optional().or(z.literal("")),
  message: z.string({ error: "message requis" }).trim().min(1, "message requis").max(5000),
  pageUrl: z.string().trim().max(500).optional().or(z.literal("")),
  website: z.string().optional(), // champ piège : doit rester vide
  "cf-turnstile-response": z.string().optional(),
});

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: CORS_HEADERS });

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await params;
  const site = await prisma.site.findUnique({ where: { siteKey }, select: { id: true, clientId: true, name: true, status: true } });
  if (!site || site.status === "SUSPENDU") return json({ ok: false, error: "site inconnu" }, 404);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "ip";
  if (!rateLimit(`${siteKey}:${ip}`)) return json({ ok: false, error: "trop d’envois, réessayez plus tard" }, 429);

  let raw: Record<string, unknown>;
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  else raw = Object.fromEntries((await req.formData().catch(() => new FormData())).entries());

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return json({ ok: false, error: parsed.error.issues[0].message }, 400);
  const d = parsed.data;

  // Champ piège rempli = robot : on répond OK sans rien enregistrer.
  if (d.website) return json({ ok: true });

  const captcha = await verifyTurnstile(d["cf-turnstile-response"] ?? null, ip);
  if (!captcha.ok) return json({ ok: false, error: captcha.reason }, 403);

  const request = await prisma.contactRequest.create({
    data: { siteId: site.id, name: d.name, email: d.email || null, phone: d.phone || null, type: d.type || null, message: d.message, pageUrl: d.pageUrl || null },
  });

  const href = `/sites/${site.id}/activite`;
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const lines = [d.type && `<strong>Objet :</strong> ${esc(d.type)}`, d.phone && `<strong>Téléphone :</strong> <a href="tel:${esc(d.phone)}">${esc(d.phone)}</a>`, d.email && `<strong>Email :</strong> <a href="mailto:${esc(d.email)}">${esc(d.email)}</a>`].filter(Boolean).join("<br>");
  await notifyClient({
    clientId: site.clientId, siteId: site.id, kind: "DEMANDE_CONTACT", pref: "contactRequests",
    title: `Nouvelle demande de ${d.name}`,
    body: d.type ? `${d.type} · ${d.message.slice(0, 100)}` : d.message.slice(0, 120),
    href,
    emailSubject: `${d.name} vous a contacté via ${site.name}`,
    emailHtml: layout(`Nouvelle demande de ${esc(d.name)}`, `<p>${lines}</p><blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #e4e4e7;color:#3f3f46;white-space:pre-wrap">${esc(d.message)}</blockquote><p style="font-size:13px;color:#71717a">Reçue via ${esc(site.name)}${d.pageUrl ? ` (${esc(d.pageUrl)})` : ""}.</p>`, { label: "Voir dans mon espace", href: appUrl(href) }),
  });

  return json({ ok: true, id: request.id });
}
