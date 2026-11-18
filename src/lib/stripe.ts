/**
 * Stripe (lecture seule) : les abonnements et les factures sont copiés dans l'app à chaque synchronisation
 * (bouton « Actualiser Stripe » de Pilotage → Finance, tâche de fond toutes les 6 h, ou /api/cron/stripe).
 * - MRR réel (abonnements actifs ou en retard de paiement, remises non déduites), encaissé du mois, factures impayées ;
 * - chaque client Stripe est rapproché d'une fiche client par email (fiche, signataire de contrat, contacts) ;
 * - jamais d'écriture côté Stripe. Clé : Admin → Paramètres (ou STRIPE_SECRET_KEY dans .env).
 */
import { prisma } from "@/lib/prisma";
import { getSecret } from "@/lib/settings";
import { connecteurActif, journal, marquerSync } from "@/lib/connecteurs";

const API = "https://api.stripe.com/v1";

type Customer = { id: string; name: string | null; email: string | null; deleted?: boolean };
type Price = { unit_amount: number | null; currency: string; nickname: string | null; recurring: { interval: "day" | "week" | "month" | "year"; interval_count: number } | null; product: { name: string } | string | null };
type Sub = {
  id: string; status: string; customer: Customer | string; created: number; start_date: number;
  current_period_end?: number | null; cancel_at: number | null; canceled_at: number | null; ended_at: number | null;
  items: { data: { price: Price; quantity: number | null; current_period_end?: number | null }[] };
};
type Invoice = {
  id: string; number: string | null; status: string; customer: Customer | string; customer_name: string | null; customer_email: string | null;
  subscription: string | { id: string } | null; amount_due: number; amount_paid: number; amount_remaining: number; created: number; due_date: number | null;
  hosted_invoice_url: string | null; status_transitions: { paid_at: number | null } | null;
};

export const stripeConfigured = () => connecteurActif("financier");

async function headers() {
  const key = await getSecret("stripe_secret_key");
  if (!key) throw new Error("Clé Stripe manquante (Admin → Paramètres).");
  return { Authorization: `Bearer ${key}`, Accept: "application/json" };
}

/** Liste paginée (100 par page, `has_more` / `starting_after`). */
async function list<T extends { id: string }>(path: string, params: Record<string, string>, expand: string[] = []): Promise<T[]> {
  const out: T[] = [];
  let after: string | null = null;
  for (let page = 0; page < 50; page++) {
    const q = new URLSearchParams({ ...params, limit: "100" });
    for (const e of expand) q.append("expand[]", e);
    if (after) q.set("starting_after", after);
    const res = await fetch(`${API}${path}?${q}`, { headers: await headers(), signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if (res.status === 401) throw new Error("Stripe refuse la clé (Admin → Paramètres).");
    if (res.status === 403) throw new Error(`Clé Stripe sans accès à ${path} : donnez-lui les droits Abonnements, Factures et Clients en lecture.`);
    if (!res.ok) throw new Error(`Stripe répond ${res.status} sur ${path}.`);
    const json = (await res.json()) as { data: T[]; has_more: boolean };
    out.push(...json.data);
    if (!json.has_more || json.data.length === 0) break;
    after = json.data[json.data.length - 1].id;
  }
  return out;
}

const date = (s: number | null | undefined) => (s ? new Date(s * 1000) : null);
const cust = (c: Customer | string) => (typeof c === "string" ? { id: c, name: null, email: null } : c);
const MOIS: Record<string, number> = { day: 365 / 12, week: 52 / 12, month: 1, year: 1 / 12 };

/** Montant mensuel (centimes) d'un abonnement : somme des lignes ramenées au mois. */
function mensuel(sub: Sub) {
  return Math.round(sub.items.data.reduce((a, it) => {
    const p = it.price;
    if (!p.recurring || !p.unit_amount) return a;
    return a + (p.unit_amount * (it.quantity ?? 1) * MOIS[p.recurring.interval]) / (p.recurring.interval_count || 1);
  }, 0));
}
function libelle(sub: Sub) {
  const noms = sub.items.data.map((it) => it.price.nickname || (typeof it.price.product === "object" && it.price.product ? it.price.product.name : null)).filter(Boolean) as string[];
  return [...new Set(noms)].join(" + ") || "Abonnement";
}

/** Fiches clients par email (fiche, signataires de contrats, contacts), en minuscules. */
async function indexClients() {
  const clients = await prisma.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true, email: true, contrats: { select: { signataireEmail: true } }, contacts: { select: { email: true } } } });
  const parEmail = new Map<string, string>();
  const parNom = new Map<string, string>();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const c of clients) {
    const emails = [c.email, ...c.contrats.map((x) => x.signataireEmail), ...c.contacts.map((x) => x.email)].filter(Boolean) as string[];
    for (const e of emails) if (!parEmail.has(e.toLowerCase())) parEmail.set(e.toLowerCase(), c.id);
    if (norm(c.name)) parNom.set(norm(c.name), c.id);
  }
  return (email: string | null, nom: string | null) => (email ? parEmail.get(email.toLowerCase()) : undefined) ?? (nom ? parNom.get(norm(nom)) : undefined) ?? null;
}

export type SyncStripeResult = { ok: boolean; abonnements: number; factures: number; error?: string };

/** Synchronisation complète : tous les abonnements, les factures ouvertes / irrécouvrables, et les factures payées des 13 derniers mois. */
export async function syncStripe(): Promise<SyncStripeResult> {
  if (!(await stripeConfigured())) return { ok: false, abonnements: 0, factures: 0, error: "Connecteur Stripe désactivé ou clé manquante (Admin → Paramètres)." };
  try {
    const depuis = Math.floor(new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 12, 1)).getTime() / 1000);
    const [subs, ouvertes, irrecouvrables, payees, clientDe] = await Promise.all([
      list<Sub>("/subscriptions", { status: "all" }, ["data.customer", "data.items.data.price.product"]),
      list<Invoice>("/invoices", { status: "open" }, ["data.customer"]),
      list<Invoice>("/invoices", { status: "uncollectible" }, ["data.customer"]),
      list<Invoice>("/invoices", { status: "paid", "created[gte]": String(depuis) }, ["data.customer"]),
      indexClients(),
    ]);
    const factures = [...ouvertes, ...irrecouvrables, ...payees];

    await prisma.$transaction(async (tx) => {
      // Abonnements : on remplace tout (lecture seule, Stripe fait foi).
      await tx.stripeAbonnement.deleteMany({ where: { id: { notIn: subs.map((s) => s.id) } } });
      for (const s of subs) {
        const c = cust(s.customer);
        const data = {
          customerId: c.id, customerNom: c.name, customerEmail: c.email, clientId: clientDe(c.email, c.name),
          statut: s.status, libelle: libelle(s), montantMensuelCents: mensuel(s), intervalle: s.items.data[0]?.price.recurring?.interval ?? "month",
          quantite: s.items.data.reduce((a, it) => a + (it.quantity ?? 1), 0) || 1,
          debutAt: date(s.start_date ?? s.created)!, periodeFinAt: date(s.current_period_end ?? s.items.data[0]?.current_period_end),
          annulationAt: date(s.cancel_at ?? s.canceled_at), finAt: date(s.ended_at),
        };
        await tx.stripeAbonnement.upsert({ where: { id: s.id }, create: { id: s.id, ...data }, update: data });
      }
      // Factures : les ouvertes / irrécouvrables sont remplacées ; les payées s'accumulent (historique), les autres statuts ne sont pas suivis.
      await tx.stripeFacture.deleteMany({ where: { statut: { in: ["open", "uncollectible"] }, id: { notIn: factures.map((f) => f.id) } } });
      for (const f of factures) {
        const c = cust(f.customer);
        const nom = f.customer_name ?? c.name, email = f.customer_email ?? c.email;
        const data = {
          numero: f.number, statut: f.status, customerId: c.id, customerNom: nom, customerEmail: email, clientId: clientDe(email, nom),
          abonnementId: typeof f.subscription === "string" ? f.subscription : f.subscription?.id ?? null,
          montantCents: f.amount_due, payeCents: f.amount_paid, restantCents: f.amount_remaining, creeAt: date(f.created)!, echeanceAt: date(f.due_date),
          payeAt: date(f.status_transitions?.paid_at), url: f.hosted_invoice_url,
        };
        await tx.stripeFacture.upsert({ where: { id: f.id }, create: { id: f.id, ...data }, update: data });
      }
    }, { timeout: 60_000 });

    await marquerSync("financier");
    await journal("financier", "info", `Synchronisation : ${subs.length} abonnements, ${factures.length} factures.`);
    return { ok: true, abonnements: subs.length, factures: factures.length };
  } catch (e) {
    const error = (e as Error).message;
    await journal("financier", "erreur", error);
    return { ok: false, abonnements: 0, factures: 0, error };
  }
}

/** Dernière synchronisation réussie (null si jamais). */
export async function derniereSyncStripe() {
  const s = await prisma.setting.findUnique({ where: { key: "connecteur_financier_sync_at" } });
  return s ? new Date(s.value) : null;
}

export const STATUT_ABONNEMENT: Record<string, string> = { active: "Actif", past_due: "En retard de paiement", trialing: "Période d’essai", canceled: "Annulé", unpaid: "Impayé", incomplete: "Incomplet", incomplete_expired: "Expiré", paused: "En pause" };
const EN_COURS = ["active", "past_due", "trialing", "unpaid", "paused"];

/** Chiffres Stripe pour Pilotage → Finance : MRR réel, abonnements, encaissements, impayés, et écart avec les contrats. */
export async function statsStripe(now = new Date()) {
  const debutMois = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const debutMoisPrecedent = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const [configure, derniereSync, abonnements, impayes, encaisse, encaissePrecedent, derniereErreur] = await Promise.all([
    stripeConfigured(),
    derniereSyncStripe(),
    prisma.stripeAbonnement.findMany({ where: { statut: { in: EN_COURS } }, orderBy: [{ statut: "asc" }, { montantMensuelCents: "desc" }], include: { client: { select: { id: true, name: true } } } }),
    prisma.stripeFacture.findMany({ where: { statut: { in: ["open", "uncollectible"] }, restantCents: { gt: 0 } }, orderBy: [{ echeanceAt: "asc" }, { creeAt: "asc" }], include: { client: { select: { id: true, name: true } } } }),
    prisma.stripeFacture.aggregate({ where: { statut: "paid", payeAt: { gte: debutMois } }, _sum: { payeCents: true }, _count: true }),
    prisma.stripeFacture.aggregate({ where: { statut: "paid", payeAt: { gte: debutMoisPrecedent, lt: debutMois } }, _sum: { payeCents: true } }),
    prisma.connecteurLog.findFirst({ where: { connecteur: "financier", niveau: "erreur" }, orderBy: { createdAt: "desc" }, select: { message: true, createdAt: true } }),
  ]);
  const actifs = abonnements.filter((a) => a.statut === "active" || a.statut === "past_due");
  const mrr = actifs.reduce((a, s) => a + s.montantMensuelCents, 0);
  const enRetard = abonnements.filter((a) => a.statut === "past_due" || a.statut === "unpaid");
  const enEssai = abonnements.filter((a) => a.statut === "trialing");
  const annulationsPrevues = actifs.filter((a) => a.annulationAt && a.annulationAt > now);
  const nouveauxMois = actifs.filter((a) => a.debutAt >= debutMois);
  const erreur = derniereErreur && (!derniereSync || derniereErreur.createdAt > derniereSync) ? derniereErreur : null;
  return {
    configure, derniereSync, erreur,
    mrr, actifs: actifs.length, enRetard, enEssai: enEssai.length, annulationsPrevues, nouveauxMois: nouveauxMois.reduce((a, s) => a + s.montantMensuelCents, 0),
    encaisseMois: encaisse._sum.payeCents ?? 0, facturesPayeesMois: encaisse._count, encaisseMoisPrecedent: encaissePrecedent._sum.payeCents ?? 0,
    impayes, impayesTotal: impayes.reduce((a, f) => a + f.restantCents, 0),
    abonnements,
    nonRapproches: abonnements.filter((a) => !a.clientId).length,
  };
}

/** Encaissements Stripe mois par mois (13 derniers mois), en centimes, pour la courbe de Finance. */
export async function encaissementsParMois(now = new Date(), mois = 13) {
  const debut = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (mois - 1), 1));
  const rows = await prisma.stripeFacture.findMany({ where: { statut: "paid", payeAt: { gte: debut } }, select: { payeAt: true, payeCents: true } });
  const out = new Map<string, number>();
  for (let i = 0; i < mois; i++) out.set(new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + i, 1)).toISOString().slice(0, 7), 0);
  for (const r of rows) { const k = r.payeAt!.toISOString().slice(0, 7); if (out.has(k)) out.set(k, out.get(k)! + r.payeCents); }
  return out;
}

export function startStripeTicker() {
  const g = globalThis as unknown as { __accoStripe?: NodeJS.Timeout };
  if (g.__accoStripe) return;
  const run = () => { syncStripe().catch((e) => console.warn("[stripe]", (e as Error).message)); };
  setTimeout(run, 90_000);
  g.__accoStripe = setInterval(run, 6 * 3600_000);
}
