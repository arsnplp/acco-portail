-- Conseils business (espace client), mis en cache par site.
ALTER TABLE "Site" ADD COLUMN "conseils" JSONB, ADD COLUMN "conseilsAt" TIMESTAMP(3);
