-- Heure de relance facultative : rappel (push + bandeau dans l'app) au commercial associé.
ALTER TABLE "Prospect" ADD COLUMN "rappelAt" TIMESTAMP(3), ADD COLUMN "rappelEnvoyeAt" TIMESTAMP(3);
CREATE INDEX "Prospect_rappelAt_idx" ON "Prospect"("rappelAt");
