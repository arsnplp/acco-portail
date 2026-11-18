-- Connecteur Stripe (lecture seule) : abonnements et factures copiés à chaque synchronisation.
CREATE TABLE "StripeAbonnement" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerNom" TEXT,
    "customerEmail" TEXT,
    "clientId" TEXT,
    "statut" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "montantMensuelCents" INTEGER NOT NULL,
    "intervalle" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "debutAt" TIMESTAMP(3) NOT NULL,
    "periodeFinAt" TIMESTAMP(3),
    "annulationAt" TIMESTAMP(3),
    "finAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StripeAbonnement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StripeFacture" (
    "id" TEXT NOT NULL,
    "numero" TEXT,
    "statut" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerNom" TEXT,
    "customerEmail" TEXT,
    "clientId" TEXT,
    "abonnementId" TEXT,
    "montantCents" INTEGER NOT NULL,
    "payeCents" INTEGER NOT NULL,
    "restantCents" INTEGER NOT NULL,
    "creeAt" TIMESTAMP(3) NOT NULL,
    "echeanceAt" TIMESTAMP(3),
    "payeAt" TIMESTAMP(3),
    "url" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StripeFacture_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StripeAbonnement_statut_idx" ON "StripeAbonnement"("statut");
CREATE INDEX "StripeAbonnement_clientId_idx" ON "StripeAbonnement"("clientId");
CREATE INDEX "StripeFacture_statut_idx" ON "StripeFacture"("statut");
CREATE INDEX "StripeFacture_clientId_idx" ON "StripeFacture"("clientId");
CREATE INDEX "StripeFacture_creeAt_idx" ON "StripeFacture"("creeAt");
ALTER TABLE "StripeAbonnement" ADD CONSTRAINT "StripeAbonnement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StripeFacture" ADD CONSTRAINT "StripeFacture_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
