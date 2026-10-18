/**
 * Données de démo : 3 admins (comptes Supabase Auth existants), 2 clients, 3 sites dont 1 en création.
 * Lancer : npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ADMINS = [
  { email: "arsene@acco-lab.fr", firstName: "Arsène", lastName: "Lecoq" },
  { email: "bilel@acco-lab.fr", firstName: "Bilel", lastName: null },
  { email: "lucas@acco-lab.fr", firstName: "Lucas", lastName: null },
];

const DEMO_CLIENT_USERS = [
  { email: "demo.boulangerie@acco-lab.fr", firstName: "Marie", lastName: "Dupont" },
  { email: "demo.plombier@acco-lab.fr", firstName: "Karim", lastName: "Benali" },
];

/** Récupère ou crée l'utilisateur Supabase Auth sans envoyer d'email. */
async function ensureAuthUser(email: string, meta: Record<string, string | null>) {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const found = data?.users.find((u) => u.email?.toLowerCase() === email);
  if (found) return found.id;
  const { data: created, error } = await supabase.auth.admin.createUser({ email, email_confirm: true, user_metadata: meta });
  if (error) throw error;
  return created.user.id;
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000);
const inDays = (n: number) => new Date(Date.now() + n * 86400_000);

async function main() {
  // ── Équipe
  for (const a of ADMINS) {
    const id = await ensureAuthUser(a.email, { first_name: a.firstName, last_name: a.lastName, role: "ADMIN" });
    await prisma.user.upsert({
      where: { id },
      create: { id, email: a.email, firstName: a.firstName, lastName: a.lastName, role: "ADMIN" },
      update: { role: "ADMIN", firstName: a.firstName, lastName: a.lastName },
    });
  }
  const arsene = await prisma.user.findUniqueOrThrow({ where: { email: "arsene@acco-lab.fr" } });

  // ── Paramètres
  await prisma.setting.upsert({ where: { key: "google_review_url" }, create: { key: "google_review_url", value: "https://g.page/r/acco-lab/review" }, update: {} });
  await prisma.setting.upsert({ where: { key: "referral_reward_label" }, create: { key: "referral_reward_label", value: "1 mois d’abonnement offert" }, update: {} });

  // ── Client 1 : boulangerie, 2 sites en ligne
  const [u1, u2] = await Promise.all(
    DEMO_CLIENT_USERS.map(async (u) => {
      const id = await ensureAuthUser(u.email, { first_name: u.firstName, last_name: u.lastName });
      return prisma.user.upsert({
        where: { id },
        create: { id, email: u.email, firstName: u.firstName, lastName: u.lastName, role: "CLIENT" },
        update: { firstName: u.firstName, lastName: u.lastName },
      });
    }),
  );

  const boulangerie = await prisma.client.upsert({
    where: { referralCode: "demo-boulangerie" },
    create: {
      name: "Boulangerie Dupont",
      address: "12 rue des Martyrs, 75009 Paris",
      phone: "01 42 00 00 01",
      email: "contact@boulangerie-dupont.fr",
      referralCode: "demo-boulangerie",
      memberships: { create: { userId: u1.id, role: "OWNER" } },
      conversation: { create: {} },
    },
    update: {},
  });

  const siteBoul = await prisma.site.upsert({
    where: { siteKey: "demo-boulangerie-dupont" },
    create: {
      clientId: boulangerie.id,
      name: "boulangerie-dupont.fr",
      url: "https://boulangerie-dupont.fr",
      status: "EN_LIGNE",
      projectStep: "MISE_EN_LIGNE",
      launchedAt: daysAgo(210),
      siteKey: "demo-boulangerie-dupont",
      searchConsoleProp: "sc-domain:boulangerie-dupont.fr",
      history: {
        create: [
          {
            kind: "CREATION",
            title: "Création du site",
            happenedAt: daysAgo(210),
            authorId: arsene.id,
            items: [
              "5 pages : Accueil, Nos pains, Pâtisseries, Commander, Contact",
              "SEO technique : balises, vitesse, mobile",
              "Données structurées (boulangerie, horaires, avis)",
              "Sitemap et indexation Google",
              "Mentions légales et politique de confidentialité",
              "Performances : chargement < 1 s",
            ],
          },
          { kind: "MISE_EN_LIGNE", title: "Mise en ligne", happenedAt: daysAgo(208), authorId: arsene.id, items: [] },
          { kind: "INTERVENTION", title: "Horaires d’été mis à jour", happenedAt: daysAgo(90), authorId: arsene.id, items: ["Page Contact", "Fiche Google"] },
          { kind: "INTERVENTION", title: "Ajout de la galette des rois", happenedAt: daysAgo(12), authorId: arsene.id, items: ["Page Pâtisseries"] },
        ],
      },
      healthChecks: { create: { isUp: true, statusCode: 200, responseMs: 320, sslExpiresAt: inDays(70) } },
      contactRequests: {
        create: [
          { name: "Sophie Martin", phone: "06 12 34 56 78", type: "Commande", message: "Bonjour, je voudrais commander un gâteau d’anniversaire pour samedi, 8 personnes.", createdAt: daysAgo(1) },
          { name: "Julien Petit", email: "julien@example.fr", type: "Question", message: "Faites-vous du pain sans gluten ?", createdAt: daysAgo(3), status: "TRAITEE", handledAt: daysAgo(2) },
          { name: "Comité d’entreprise Alto", email: "ce@alto.fr", type: "Devis", message: "Devis pour 40 viennoiseries chaque lundi matin.", createdAt: daysAgo(9), status: "DEVENU_CLIENT", handledAt: daysAgo(8) },
        ],
      },
      changeRequests: {
        create: [
          { title: "Changer la photo d’accueil", description: "Mettre la nouvelle photo de la vitrine de Noël.", page: "Accueil", status: "TERMINEE", completedAt: daysAgo(5), confirmedAt: daysAgo(4), assigneeId: arsene.id, createdAt: daysAgo(7) },
          { title: "Ajouter le numéro de la seconde boutique", description: "Nous ouvrons une seconde boutique rue Lepic.", page: "Contact", status: "EN_COURS", startedAt: daysAgo(1), assigneeId: arsene.id, createdAt: daysAgo(2) },
        ],
      },
    },
    update: {},
  });

  const siteTraiteur = await prisma.site.upsert({
    where: { siteKey: "demo-dupont-traiteur" },
    create: {
      clientId: boulangerie.id,
      name: "dupont-traiteur.fr",
      url: "https://dupont-traiteur.fr",
      status: "EN_LIGNE",
      projectStep: "MISE_EN_LIGNE",
      launchedAt: daysAgo(40),
      siteKey: "demo-dupont-traiteur",
      history: { create: [{ kind: "CREATION", title: "Création du site", happenedAt: daysAgo(40), items: ["3 pages", "SEO technique", "Pages légales"] }] },
      healthChecks: { create: { isUp: true, statusCode: 200, responseMs: 410, sslExpiresAt: inDays(82) } },
    },
    update: {},
  });

  await prisma.subscription.createMany({
    data: [
      { clientId: boulangerie.id, siteId: siteBoul.id, label: "Site vitrine — abonnement", billing: "MENSUEL", priceCents: 4900, monthlyQuota: 2, startedAt: daysAgo(210), commitmentEndsAt: inDays(45) },
      { clientId: boulangerie.id, siteId: siteTraiteur.id, label: "Site vitrine — abonnement", billing: "MENSUEL", priceCents: 4900, monthlyQuota: 2, startedAt: daysAgo(40), commitmentEndsAt: inDays(325) },
    ],
    skipDuplicates: true,
  });

  await prisma.notification.createMany({
    data: [
      { clientId: boulangerie.id, siteId: siteBoul.id, kind: "DEMANDE_CONTACT", title: "Nouvelle demande de Sophie Martin", body: "Commande de gâteau d’anniversaire", href: `/sites/${siteBoul.id}/activite`, createdAt: daysAgo(1) },
      { clientId: boulangerie.id, siteId: siteBoul.id, kind: "MODIFICATION_TERMINEE", title: "Modification terminée", body: "Changer la photo d’accueil", href: `/sites/${siteBoul.id}/modifications`, createdAt: daysAgo(5) },
    ],
  });

  // ── Client 2 : plombier, 1 site en création
  const plombier = await prisma.client.upsert({
    where: { referralCode: "demo-plombier" },
    create: {
      name: "Benali Plomberie",
      address: "8 avenue Jean Jaurès, 93100 Montreuil",
      phone: "06 00 00 00 02",
      referralCode: "demo-plombier",
      memberships: { create: { userId: u2.id, role: "OWNER" } },
      conversation: { create: {} },
    },
    update: {},
  });

  await prisma.site.upsert({
    where: { siteKey: "demo-benali-plomberie" },
    create: {
      clientId: plombier.id,
      name: "benali-plomberie.fr",
      status: "EN_CREATION",
      projectStep: "MAQUETTE",
      previewUrl: "https://preprod.acco-lab.fr/benali",
      siteKey: "demo-benali-plomberie",
      assets: {
        create: [
          { kind: "LOGO", label: "Votre logo", storagePath: "demo/logo.png", fileName: "logo.png", uploadedAt: daysAgo(6) },
          { kind: "TEXTE", label: "Présentation de l’entreprise" },
          { kind: "PHOTO", label: "Photos de vos réalisations (5 à 10)" },
        ],
      },
      history: { create: [{ kind: "INTERVENTION", title: "Brief validé", happenedAt: daysAgo(8), items: ["Site vitrine 4 pages", "Zone : Montreuil et alentours"] }] },
    },
    update: {},
  });

  await prisma.subscription.createMany({
    data: [{ clientId: plombier.id, label: "Site vitrine — abonnement", billing: "MENSUEL", priceCents: 4900, monthlyQuota: 2, startedAt: daysAgo(8), commitmentEndsAt: inDays(357) }],
    skipDuplicates: true,
  });

  console.log("Seed OK");
  console.log("Comptes de démo (lien magique) :", DEMO_CLIENT_USERS.map((u) => u.email).join(", "));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
