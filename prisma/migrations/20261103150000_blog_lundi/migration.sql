-- Blogs : un article par lundi et par site, file d'attente, rédaction, automatisation.
ALTER TYPE "ArticleStatut" ADD VALUE IF NOT EXISTS 'REDIGE';
ALTER TABLE "Article" ADD COLUMN "prevuPour" TIMESTAMP(3), ADD COLUMN "contenu" TEXT, ADD COLUMN "motsCles" TEXT, ADD COLUMN "genereParIA" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Site" ADD COLUMN "blogAuto" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Article_siteId_prevuPour_key" ON "Article"("siteId", "prevuPour");
