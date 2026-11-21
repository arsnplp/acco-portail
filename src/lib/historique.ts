/**
 * Historique général côté client : tout ce que l'équipe a fait pour lui, toutes sources confondues, du plus récent au plus ancien.
 * Lecture seule, textes déjà formulés pour le client (jamais les notes internes).
 */
import { prisma } from "@/lib/prisma";

export type Evenement = { id: string; date: Date; titre: string; detail?: string | null; puces?: string[]; site?: string | null; href?: string | null; kind: "site" | "modification" | "article" | "contrat" | "document" | "rdv" | "service" | "difficulte" | "echange" };

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const moisLabel = (d: Date) => `${MOIS[d.getMonth()]} ${d.getFullYear()}`;

export async function historiqueClient(clientId: string, limite = 300): Promise<Evenement[]> {
  const [hist, articles, contrats, docs, rdvs, sites, orders, difficultes, echanges] = await Promise.all([
    prisma.siteHistoryEntry.findMany({ where: { site: { clientId } }, orderBy: { happenedAt: "desc" }, take: limite, include: { site: { select: { id: true, name: true } } } }),
    prisma.article.findMany({ where: { site: { clientId }, publieAt: { not: null } }, orderBy: { publieAt: "desc" }, take: limite, select: { id: true, titre: true, publieAt: true, site: { select: { id: true, name: true } } } }),
    prisma.contrat.findMany({ where: { clientId, signeAt: { not: null } }, orderBy: { signeAt: "desc" }, select: { id: true, titre: true, reference: true, signeAt: true } }),
    prisma.document.findMany({ where: { clientId, uploadedByClient: false, kind: { not: "FACTURE" } }, orderBy: { createdAt: "desc" }, take: limite, select: { id: true, title: true, createdAt: true, site: { select: { name: true } } } }),
    prisma.rendezVous.findMany({ where: { clientId, resultat: "FAIT" }, orderBy: { debut: "desc" }, take: limite, select: { id: true, titre: true, debut: true, site: { select: { name: true } } } }),
    prisma.site.findMany({ where: { clientId }, select: { id: true, name: true, createdAt: true, maquetteEnvoyeeAt: true } }),
    prisma.order.findMany({ where: { clientId, status: "VALIDEE", validatedAt: { not: null } }, orderBy: { validatedAt: "desc" }, select: { id: true, validatedAt: true, offer: { select: { name: true } } } }),
    prisma.difficulte.findMany({ where: { clientId, resoluAt: { not: null } }, orderBy: { resoluAt: "desc" }, select: { id: true, resoluAt: true, reponse: true } }),
    prisma.echange.findMany({ where: { OR: [{ clientId }, { prospect: { clientId } }], type: { in: ["APPEL", "MAIL", "RDV"] } }, orderBy: { date: "desc" }, take: limite, select: { id: true, type: true, date: true, origine: true, auteurId: true, meta: true } }),
  ]);
  const ev: Evenement[] = [
    ...hist.map((h) => ({ id: `h${h.id}`, date: h.happenedAt, titre: h.title, detail: h.description, puces: h.items, site: h.site.name, href: `/sites/${h.site.id}`, kind: "site" as const })),
    ...articles.map((a) => ({ id: `a${a.id}`, date: a.publieAt!, titre: "Article publié", detail: a.titre, site: a.site.name, href: `/sites/${a.site.id}/blog`, kind: "article" as const })),
    ...contrats.map((c) => ({ id: `c${c.id}`, date: c.signeAt!, titre: "Contrat signé", detail: `${c.titre} · ${c.reference}`, href: "/compte/documents", kind: "contrat" as const })),
    ...docs.map((d) => ({ id: `d${d.id}`, date: d.createdAt, titre: "Document mis à disposition", detail: d.title, site: d.site?.name, href: "/compte/documents", kind: "document" as const })),
    ...rdvs.map((r) => ({ id: `r${r.id}`, date: r.debut, titre: "Rendez-vous", detail: r.titre, site: r.site?.name, kind: "rdv" as const })),
    ...sites.map((s) => ({ id: `s${s.id}`, date: s.createdAt, titre: "Lancement de votre projet", site: s.name, href: `/sites/${s.id}`, kind: "site" as const })),
    ...sites.filter((s) => s.maquetteEnvoyeeAt).map((s) => ({ id: `q${s.id}`, date: s.maquetteEnvoyeeAt!, titre: "Maquette envoyée", site: s.name, href: `/sites/${s.id}`, kind: "site" as const })),
    ...orders.map((o) => ({ id: `o${o.id}`, date: o.validatedAt!, titre: "Service activé", detail: o.offer?.name, href: "/compte", kind: "service" as const })),
    ...difficultes.map((d) => ({ id: `f${d.id}`, date: d.resoluAt!, titre: "Difficulté résolue", detail: d.reponse, href: "/difficultes", kind: "difficulte" as const })),
    // Appels (Aircall ou notés), RDV notés, emails saisis par l'équipe ; pas les emails synchronisés (alertes, automatiques).
    ...echanges.filter((e) => (e.auteurId || e.origine === "aircall") && !(e.type === "MAIL" && e.origine === "gmail")).map((e) => {
      const objet = (e.meta as { objet?: string; subject?: string } | null)?.objet ?? (e.meta as { subject?: string } | null)?.subject ?? null;
      return { id: `e${e.id}`, date: e.date, titre: e.type === "APPEL" ? "Appel avec vous" : e.type === "MAIL" ? "Email échangé" : "Rendez-vous", detail: objet, kind: "echange" as const };
    }),
  ];
  return ev.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limite);
}
