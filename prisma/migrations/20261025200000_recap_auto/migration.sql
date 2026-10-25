-- Récap mensuel automatique : activé dès qu'une synchro Search Console réelle réussit.
ALTER TABLE "Site" ADD COLUMN "recapAuto" BOOLEAN NOT NULL DEFAULT false;
-- Les sites déjà liés à une propriété et déjà synchronisés passent en automatique.
UPDATE "Site" SET "recapAuto" = true
WHERE "searchConsoleProp" IS NOT NULL AND "status" = 'EN_LIGNE'
  AND EXISTS (SELECT 1 FROM "MonthlyRecap" r WHERE r."siteId" = "Site"."id" AND r."sentAt" IS NOT NULL);
