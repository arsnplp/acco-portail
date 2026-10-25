/**
 * Données de test pour l'espace Commercial UNIQUEMENT (prospects, contacts, échanges, RDV, projets, tâches).
 * Ne touche à rien du portail : aucun client, site, abonnement, compte, mail ni notification.
 * Tout est marqué « (test) » et se supprime en une commande.
 *
 *   npx tsx --env-file=.env scripts/donnees-test-crm.mts --creer      # ajoute ~40 prospects de test
 *   npx tsx --env-file=.env scripts/donnees-test-crm.mts --supprimer  # retire toutes les données de test
 */
import { PrismaClient, type EchangeType, type ProspectSource, type ProspectStatut } from "@prisma/client";

const prisma = new PrismaClient();
const TAG = "test-"; // préfixe des legacyId : c'est lui qui permet de tout retrouver et supprimer

async function supprimer() {
  const [p, pr] = await prisma.$transaction([
    prisma.prospect.deleteMany({ where: { legacyId: { startsWith: TAG } } }), // contacts, échanges, RDV suivent
    prisma.projet.deleteMany({ where: { legacyId: { startsWith: TAG } } }), // tâches et sous-tâches suivent
  ]);
  console.log(`✓ Supprimé : ${p.count} prospect(s) de test (avec contacts, échanges, RDV) et ${pr.count} projet(s) de test.`);
}

// Générateur pseudo-aléatoire stable : les mêmes données à chaque création.
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;
const day = (n: number, h = 10, m = 0) => { const d = new Date(); d.setUTCHours(h - 1, m, 0, 0); d.setUTCDate(d.getUTCDate() + n); return d; }; // ~heure de Paris

const PRENOMS = ["Camille", "Julie", "Sarah", "Inès", "Léa", "Manon", "Nadia", "Sophie", "Karim", "Thomas", "Hugo", "Yanis", "Lucas", "Mehdi", "Paul", "Emma", "Chloé", "Laura", "Nicolas", "Amandine"];
const NOMS = ["Martin", "Bernard", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Michel", "Garcia", "Roux", "Fournier", "Girard", "Bonnet", "Dupont", "Lambert", "Fontaine", "Rousseau", "Vincent", "Muller"];
const CIBLES: { nom: string; societes: string[] }[] = [
  { nom: "Esthéticienne", societes: ["Institut Éclat", "Belle Peau", "L'Atelier Beauté", "Douceur de Soi", "Nail Studio Lumière", "Spa des Lys"] },
  { nom: "Auto-école", societes: ["Auto-École du Centre", "Permis Express", "Conduite Plus", "ECF Horizon", "Auto-École Mistral"] },
  { nom: "Coach sportif", societes: ["FitZone Coaching", "Move & Go", "Coach Énergie", "Body Studio", "Sport Santé 13"] },
  { nom: "Pilates", societes: ["Pilates Harmonie", "Studio Reformer", "Core Pilates", "Pilates & Café"] },
  { nom: "Restaurant", societes: ["Le Petit Bistrot", "Chez Marcel", "La Table du Marché", "Pizzeria Bella", "Le Comptoir"] },
  { nom: "Jardinier", societes: ["Jardins de Provence", "Vert Paysage", "L'Herbe Folle"] },
];
const VILLES = ["13100 Aix-en-Provence", "13001 Marseille", "13090 Aix-en-Provence", "13400 Aubagne", "13008 Marseille", "13770 Venelles", "75011 Paris", "75002 Paris"];
const RUES = ["rue de la République", "cours Mirabeau", "avenue des Belges", "boulevard Baille", "rue d'Italie", "rue Paradis", "place du Marché"];
const NOTES: Record<EchangeType, string[]> = {
  NRP: ["", "Messagerie", "Barrage secrétaire", "Sonne dans le vide"],
  APPEL: ["Intéressée mais veut en parler à son associé", "Rappeler en fin de semaine", "A un site Wix qu'elle trouve vieux", "Demande les tarifs par mail", "Pas le temps, rappeler le mois prochain"],
  MAIL: ["Envoi de la présentation et des tarifs", "Relance mail après appel", "Envoi d'exemples de sites"],
  PP: ["Passage en boutique, carte laissée", "Vu le gérant sur place, très ouvert", "Passage : fermé, repasser mardi"],
  PRISE_RDV: ["RDV pris pour présenter la maquette", "RDV visio calé avec la gérante"],
  RDV: ["RDV fait : très chaud, attend le contrat", "RDV fait : hésite sur l'abonnement", "RDV fait : veut une boutique en ligne"],
  NO_SHOW: ["Pas venue, ne répond plus", "No show, a prévenu 10 min avant", "Personne au rendez-vous"],
  NOTE: ["Note interne"],
};

/** Profil de chaque statut : où en est la relance et quels échanges ont eu lieu. */
const PARCOURS: Record<ProspectStatut, { n: number; relance: () => number; echanges: EchangeType[][] }> = {
  A_CONTACTER: { n: 12, relance: () => pick([-6, -3, -1, 0, 0, 0, 1, 2, 5]), echanges: [[], [], ["NRP"], ["PP"]] },
  A_RELANCER: { n: 9, relance: () => pick([-4, -2, -1, 0, 0, 1, 3, 7]), echanges: [["NRP", "NRP"], ["APPEL"], ["NRP", "APPEL", "MAIL"], ["PP", "APPEL"]] },
  POSER_RDV: { n: 8, relance: () => pick([-2, 0, 0, 1, 2, 4]), echanges: [["APPEL", "MAIL"], ["NRP", "APPEL"], ["PP", "APPEL", "MAIL"], ["APPEL", "PRISE_RDV", "NO_SHOW"]] },
  RDV_POSE: { n: 6, relance: () => pick([0, 1, 2, 3, 5, 8]), echanges: [["APPEL", "PRISE_RDV"], ["NRP", "APPEL", "PRISE_RDV"], ["PP", "PRISE_RDV"]] },
  A_SIGNER: { n: 4, relance: () => pick([-1, 0, 1, 2]), echanges: [["APPEL", "PRISE_RDV", "RDV"], ["PP", "PRISE_RDV", "RDV", "MAIL"]] },
  GAGNE: { n: 6, relance: () => 0, echanges: [["APPEL", "PRISE_RDV", "RDV", "MAIL"], ["PP", "PRISE_RDV", "NO_SHOW", "PRISE_RDV", "RDV"]] },
  PERDU: { n: 4, relance: () => 0, echanges: [["NRP", "NRP", "APPEL"], ["APPEL", "PRISE_RDV", "RDV"], ["APPEL", "PRISE_RDV", "NO_SHOW"]] },
};

async function creer() {
  if (await prisma.prospect.count({ where: { legacyId: { startsWith: TAG } } })) {
    console.log("Des données de test existent déjà. Pour repartir de zéro : --supprimer puis --creer.");
    return;
  }
  const team = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "COMMERCIAL"] } }, select: { id: true, firstName: true, email: true } });
  if (!team.length) { console.log("Aucun compte équipe trouvé."); return; }
  const cibleIds = new Map<string, string>();
  for (const c of CIBLES) cibleIds.set(c.nom, (await prisma.cible.upsert({ where: { nom: c.nom }, create: { nom: c.nom }, update: {} })).id);

  let i = 0, echanges = 0, rdvs = 0;
  for (const [statut, cfg] of Object.entries(PARCOURS) as [ProspectStatut, (typeof PARCOURS)[ProspectStatut]][]) {
    for (let k = 0; k < cfg.n; k++, i++) {
      const cible = pick(CIBLES);
      const societe = `${pick(cible.societes)} (test)`;
      const prenom = pick(PRENOMS), nom = pick(NOMS);
      const commercial = i % 9 === 8 ? null : team[i % team.length]!; // quelques fiches sans commercial
      // Numéros réservés à la fiction par l'ARCEP (06 39 98 xx xx) : aucun risque d'appeler quelqu'un.
      const tel = `06 39 98 ${String(10 + (i % 90)).padStart(2, "0")} ${String(10 + ((i * 7) % 90)).padStart(2, "0")}`;
      const parcours = pick(cfg.echanges);
      const start = -(parcours.length * 4 + 1 + Math.floor(rnd() * (statut === "A_CONTACTER" ? 6 : 70)));
      const p = await prisma.prospect.create({
        data: {
          legacyId: `${TAG}${i}`, societe, telephone: tel, adresse: `${1 + Math.floor(rnd() * 80)} ${pick(RUES)}, ${pick(VILLES)}`,
          cibleId: cibleIds.get(cible.nom), source: pick<ProspectSource>(["COLD_CALL", "COLD_CALL", "COLD_CALL", "PROSPECTION_PHYSIQUE", "RECOMMANDATION"]),
          statut, commercialId: commercial?.id ?? null, potentielEuros: pick([50, 80, 99, 100, 150]),
          relanceAt: statut === "GAGNE" || statut === "PERDU" ? null : day(cfg.relance(), 0),
          motifPerte: statut === "PERDU" ? pick(["Trop cher", "A déjà un site", "Pas intéressé"]) : null,
          perduAt: statut === "PERDU" ? day(start + parcours.length * 4) : null, gagneAt: statut === "GAGNE" ? day(start + parcours.length * 4) : null,
          fraisCreationEuros: statut === "GAGNE" ? pick([490, 790, 990]) : null, mensuelEuros: statut === "GAGNE" ? pick([50, 99, 150]) : null,
          createdAt: day(start - 2),
          contacts: {
            create: [
              { prenom, nom, fonction: pick(["Gérante", "Gérant", "Directrice", "Associé"]), telephone: tel, email: `${prenom}.${nom}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") + "@example.com", principal: true },
              ...(rnd() < 0.25 ? [{ prenom: pick(PRENOMS), nom, fonction: "Associé", principal: false }] : []),
            ],
          },
        },
      });
      // Historique : échanges espacés de 3 jours, le dernier il y a 1 à 3 jours.
      let dernierRdv: string | null = null;
      for (const [j, type] of parcours.entries()) {
        const d = start + j * 4;
        await prisma.echange.create({ data: { legacyId: `${TAG}${i}-${j}`, prospectId: p.id, type, notes: pick(NOTES[type]) || null, date: day(d, 9 + Math.floor(rnd() * 8), pick([0, 15, 30, 45])), auteurId: commercial?.id ?? team[0]!.id } });
        echanges++;
        if (type === "PRISE_RDV") {
          const futur = statut === "RDV_POSE";
          const suite = parcours[j + 1]; // l'échange d'après dit si le RDV a été honoré ou non
          const report = parcours[j - 1] === "NO_SHOW"; // recalé juste après un no show
          dernierRdv = (await prisma.rendezVous.create({ data: { prospectId: p.id, commercialId: commercial?.id ?? null, createdAt: day(d, 11), reportDeId: report ? dernierRdv : null, debut: futur ? day(cfg.relance(), pick([9, 10, 14, 16]), pick([0, 30])) : day(d + 3, 14), resultat: futur ? "PREVU" : suite === "NO_SHOW" ? "NO_SHOW" : "FAIT", lieu: pick(["Sur place", "Visio", null]) } })).id;
          rdvs++;
        }
      }
    }
  }
  // Un échange « aujourd'hui » pour que Ma journée affiche des appels passés.
  const today = await prisma.prospect.findFirst({ where: { legacyId: `${TAG}1` } });
  if (today) { await prisma.echange.create({ data: { legacyId: `${TAG}today`, prospectId: today.id, type: "NRP", date: day(0, 9, 30), auteurId: today.commercialId ?? team[0]!.id } }); echanges++; }

  // Production : 2 projets internes de test (sans client), pour préparer le mode Production.
  const resp = team[0]!.id;
  const projets: [string, [string, number, string[]][]][] = [
    ["Création de site web (test)", [["Cadrage client", -4, ["Valider le devis", "Récupérer logo et textes"]], ["Maquette", 2, ["Wireframe", "Valider avec le client"]], ["Mise en ligne", 10, ["Nom de domaine", "Search Console"]]]],
    ["Suivi mensuel (test)", [["Rapport mensuel", 0, ["Exporter les chiffres", "Envoyer au client"]], ["Mise à jour des contenus", 5, []]]],
  ];
  for (const [pi, [nom, taches]] of projets.entries()) {
    await prisma.projet.create({
      data: {
        legacyId: `${TAG}projet-${pi}`, nom, responsableId: resp, debut: day(-7), echeance: day(14),
        taches: { create: taches.map(([titre, d, sous], ti) => ({ legacyId: `${TAG}tache-${pi}-${ti}`, titre, responsableId: team[ti % team.length]!.id, echeance: day(d), statut: d < -2 ? "FAIT" as const : "A_FAIRE" as const, ordre: ti, sousTaches: { create: sous.map((s, si) => ({ titre: s, fait: d < -2, ordre: si })) } })) },
      },
    });
  }

  console.log(`✓ Données de test créées : ${i} prospects « (test) », ${echanges} échanges, ${rdvs} rendez-vous, ${projets.length} projets.`);
  console.log(`  Réparties entre : ${team.map((u) => u.firstName ?? u.email).join(", ")} (+ quelques fiches sans commercial).`);
  console.log("  Rien n'a été créé dans le portail (clients, sites, comptes) et aucun mail n'est parti.");
  console.log("  Pour tout retirer : npx tsx --env-file=.env scripts/donnees-test-crm.mts --supprimer");
}

if (process.argv.includes("--supprimer")) await supprimer();
else if (process.argv.includes("--creer")) await creer();
else console.log("Usage : npx tsx --env-file=.env scripts/donnees-test-crm.mts --creer | --supprimer");
await prisma.$disconnect();
