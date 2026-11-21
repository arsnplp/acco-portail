-- CreateEnum
CREATE TYPE "DifficulteType" AS ENUM ('SITE_EN_PANNE', 'ERREUR_SITE', 'FACTURE', 'AUTRE');
-- CreateEnum
CREATE TYPE "DifficulteStatut" AS ENUM ('RECUE', 'EN_COURS', 'RESOLUE');
-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'DIFFICULTE';
-- CreateTable
CREATE TABLE "Difficulte" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "siteId" TEXT,
    "type" "DifficulteType" NOT NULL DEFAULT 'AUTRE',
    "message" TEXT NOT NULL,
    "statut" "DifficulteStatut" NOT NULL DEFAULT 'RECUE',
    "reponse" TEXT,
    "traiteParId" TEXT,
    "prisEnChargeAt" TIMESTAMP(3),
    "resoluAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Difficulte_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "Difficulte_clientId_createdAt_idx" ON "Difficulte"("clientId", "createdAt");
-- CreateIndex
CREATE INDEX "Difficulte_statut_idx" ON "Difficulte"("statut");
-- AddForeignKey
ALTER TABLE "Difficulte" ADD CONSTRAINT "Difficulte_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Difficulte" ADD CONSTRAINT "Difficulte_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "Difficulte" ADD CONSTRAINT "Difficulte_traiteParId_fkey" FOREIGN KEY ("traiteParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
