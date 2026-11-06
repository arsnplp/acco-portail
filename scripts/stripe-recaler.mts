/**
 * Recale les contrats sur Stripe (abonnements en cours) : montant HT (Stripe facture TTC, TVA 20 %), début d'engagement,
 * jour de prélèvement, impayés (past_due), identifiant Stripe gardé sur le contrat et la ligne d'abonnement. Crée les clients
 * abonnés dans Stripe mais absents de l'app. Aucun mail ni compte. Relançable.
 *   npx tsx --env-file=.env --tsconfig tsconfig.json scripts/stripe-recaler.mts [--confirmer]
 */
import { prisma } from "../src/lib/prisma";

const confirm = process.argv.includes("--confirmer");
const KEY = process.env.STRIPE_API_KEY;
if (!KEY) { console.log("STRIPE_API_KEY manquante dans .env"); process.exit(1); }

/** Email du client Stripe → nom du client dans l'app (rapprochements confirmés par Arsène le 6 nov. 2026). */
const CLIENT_PAR_EMAIL: Record<string, string> = {
  "swella.pilates@gmail.com": "Swella", "quildamien@gmail.com": "Le Fruitier", "maxime.viou1@gmail.com": "By Carly Beauty", "midpjardin@gmail.com": "Mas if de Provence",
  "veronique@loratma.fr": "L'Or Atma", "mehdicampana016@gmail.com": "Nuisible Secure", "maisonchantal13@gmail.com": "Maison Chantal", "holeenfamily13@gmail.com": "Holeen Family",
  "rosco-75@hotmail.com": "ACS Multiservices", "loloetsamsa@hotmail.fr": "Lumi Dentaire", "glamournails.aix35@gmail.com": "Glamour Nails", "chachapilates@gmail.com": "Chacha Pilates",
  "lepokedaure@gmail.com": "Poké d'Oré", "lamournails.25@gmail.com": "L'Amour Nails", "rachton84@hotmail.fr": "Arbre à Pain",
};
/** Clients à créer s'ils n'existent pas (abonnés Stripe absents de la feuille). */
const NOUVEAUX: Record<string, { site: string; contact: { prenom?: string; nom: string; email: string } }> = {
  "L'Amour Nails": { site: "lamournails", contact: { prenom: "Thi Cam Trang", nom: "Nguyen", email: "lamournails.25@gmail.com" } }, // même gérant que Glamour Nails, second salon
  "Arbre à Pain": { site: "arbreapain.fr", contact: { prenom: "Rachid", nom: "Gouriane", email: "rachton84@hotmail.fr" } }, // pâtissier, site à venir
};
const TVA = 1.2;
const ht = (ttcCents: number) => Math.round(ttcCents / TVA);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const d = (unix?: number | null) => (unix ? new Date(unix * 1000) : null);
const plusUnAn = (x: Date) => new Date(Date.UTC(x.getUTCFullYear() + 1, x.getUTCMonth(), x.getUTCDate(), 12));

type Sub = { id: string; status: string; created: number; start_date: number; billing_cycle_anchor: number; canceled_at: number | null; customer: { id: string; name: string | null; email: string | null }; items: { data: { quantity: number; price: { unit_amount: number | null; recurring: { interval: string } | null } }[] } };

async function main() {
  const res = await fetch("https://api.stripe.com/v1/subscriptions?status=all&limit=100&expand[]=data.customer", { headers: { Authorization: `Basic ${Buffer.from(`${KEY}:`).toString("base64")}` } });
  const json = (await res.json()) as { data?: Sub[]; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  // Un abonnement par client Stripe : le plus récent non résilié, sinon le plus récent.
  const parEmail = new Map<string, Sub[]>();
  for (const s of json.data ?? []) { const e = s.customer.email?.toLowerCase(); if (!e) continue; parEmail.set(e, [...(parEmail.get(e) ?? []), s]); }
  const lignes: string[] = [];
  await prisma.$transaction(async (tx) => {
    const users = await prisma.user.findMany({ select: { id: true, email: true } });
    const bilel = users.find((u) => u.email === "bilel@acco-lab.fr")?.id ?? null;
    for (const [email, subs] of parEmail) {
      const nom = CLIENT_PAR_EMAIL[email];
      if (!nom) { lignes.push(`? ${email} : client Stripe non rapproché, ignoré`); continue; }
      const courants = subs.filter((s) => !["canceled", "incomplete_expired"].includes(s.status)).sort((a, b) => b.created - a.created);
      const sub = courants[0] ?? subs.sort((a, b) => b.created - a.created)[0];
      const premier = subs.sort((a, b) => a.start_date - b.start_date)[0];
      const ttc = sub.items.data.reduce((a, i) => a + (i.price.unit_amount ?? 0) * (i.quantity || 1), 0);
      const mensuelHt = ht(ttc), debut = d(premier.start_date)!, jour = d(sub.billing_cycle_anchor)!.getUTCDate();
      const impaye = sub.status === "past_due" || sub.status === "unpaid";
      const resilie = sub.status === "canceled";

      // Client (créé s'il manque : abonnés Stripe absents de la feuille)
      let client = (await tx.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true } })).find((c) => norm(c.name) === norm(nom));
      if (!client) {
        const n = NOUVEAUX[nom]; if (!n) { lignes.push(`? ${nom} : absent de l'app et pas prévu, ignoré`); continue; }
        client = await tx.client.create({ data: { name: nom, commercialId: bilel, engagementDebut: debut, engagementFin: plusUnAn(debut) }, select: { id: true, name: true } });
        await tx.conversation.create({ data: { clientId: client.id } });
        await tx.site.create({ data: { clientId: client.id, name: n.site, status: "EN_CREATION", projectStep: "CREER_MAQUETTE" } });
        const prospect = await tx.prospect.create({ data: { societe: nom, statut: "GAGNE", gagneAt: debut, clientId: client.id, commercialId: bilel, mensuelEuros: Math.round(mensuelHt / 100) } });
        await tx.prospectContact.create({ data: { prospectId: prospect.id, prenom: n.contact.prenom ?? null, nom: n.contact.nom, email: n.contact.email, principal: true } });
        lignes.push(`+ ${nom} : client créé (site ${n.site} en création, contact ${n.contact.email})`);
      }

      // Contrat : créé s'il manque, sinon recalé
      let contrat = await tx.contrat.findFirst({ where: { clientId: client.id }, orderBy: { createdAt: "asc" } });
      const data = {
        montantMensuelHt: mensuelHt, debutEngagement: debut, jourPrelevement: jour, moyenPaiement: "CARTE" as const, externalId: sub.id, sourceFinanciere: "stripe", majFinanciereAt: new Date(),
        impayeAt: impaye ? new Date() : null, statut: resilie ? ("TERMINE" as const) : ("SIGNE" as const),
      };
      if (!contrat) {
        const annee = debut.getUTCFullYear();
        const derniers = await tx.contrat.findMany({ where: { reference: { startsWith: `ACCO-${annee}-` } }, select: { reference: true } });
        const n = derniers.reduce((m, c) => Math.max(m, parseInt(c.reference.slice(`ACCO-${annee}-`.length), 10) || 0), 0) + 1;
        const siteId = (await tx.site.findFirst({ where: { clientId: client.id }, select: { id: true } }))?.id ?? null;
        contrat = await tx.contrat.create({ data: { ...data, reference: `ACCO-${annee}-${String(n).padStart(4, "0")}`, clientId: client.id, siteId, commercialId: bilel, titre: "Abonnement site", dureeMois: 12, reconductionMois: 12, finEngagement: plusUnAn(debut), signeAt: debut, premierPaiementAt: debut } });
      } else {
        const fin = contrat.finEngagement && contrat.finEngagement > debut ? contrat.finEngagement : plusUnAn(debut);
        await tx.contrat.update({ where: { id: contrat.id }, data: { ...data, finEngagement: fin, signeAt: contrat.signeAt ?? debut, premierPaiementAt: contrat.premierPaiementAt ?? debut } });
      }
      await tx.client.update({ where: { id: client.id }, data: { engagementDebut: debut } });
      const ligne = await tx.subscription.findFirst({ where: { clientId: client.id, billing: "MENSUEL" } });
      if (ligne) await tx.subscription.update({ where: { id: ligne.id }, data: { priceCents: mensuelHt, startedAt: debut, externalId: sub.id, contratId: contrat.id, status: resilie ? "RESILIE" : "ACTIF" } });
      else await tx.subscription.create({ data: { clientId: client.id, contratId: contrat.id, siteId: contrat.siteId, label: "Abonnement site", billing: "MENSUEL", priceCents: mensuelHt, startedAt: debut, commitmentEndsAt: contrat.finEngagement, externalId: sub.id } });
      lignes.push(`✓ ${nom} : ${(ttc / 100).toFixed(2)} € TTC → ${(mensuelHt / 100).toFixed(2)} € HT, début ${debut.toISOString().slice(0, 10)}, prélevé le ${jour}${impaye ? ", IMPAYÉ" : ""}${resilie ? ", résilié" : ""}`);
    }
    if (!confirm) throw new Error("APERCU");
  }, { timeout: 120_000, maxWait: 10_000 }).catch((e) => { if ((e as Error).message !== "APERCU") throw e; });
  console.log(confirm ? "RECALAGE EFFECTUÉ" : "APERÇU (rien n'est écrit)");
  for (const l of lignes) console.log("  " + l);
}
main().finally(() => prisma.$disconnect());
