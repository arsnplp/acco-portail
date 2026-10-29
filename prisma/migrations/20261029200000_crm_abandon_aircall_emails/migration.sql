-- Statut « Abandon » (distinct de Perdu), enrichissement des fiches, synchronisation Aircall et emails.
ALTER TYPE "ProspectStatut" ADD VALUE 'ABANDON';
ALTER TABLE "Prospect" ADD COLUMN "abandonAt" TIMESTAMP(3), ADD COLUMN "infos" JSONB, ADD COLUMN "infosAt" TIMESTAMP(3), ADD COLUMN "syncAt" TIMESTAMP(3);
ALTER TABLE "Echange" ADD COLUMN "externalId" TEXT, ADD COLUMN "meta" JSONB;
CREATE UNIQUE INDEX "Echange_externalId_key" ON "Echange"("externalId");
