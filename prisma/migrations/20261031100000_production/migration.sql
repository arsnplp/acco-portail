-- Production : pipeline à 6 étapes, développeur et échéances par site, articles de blog, flux d'activité.
ALTER TYPE "ProjectStep" RENAME TO "ProjectStep_old";
CREATE TYPE "ProjectStep" AS ENUM ('PREPARATION_V1', 'PRESENTATION_V1', 'PEAUFINEMENT', 'VALIDATION_CLIENT', 'FINITION', 'LIVRAISON');
ALTER TABLE "Site" ALTER COLUMN "projectStep" DROP DEFAULT;
ALTER TABLE "Site" ALTER COLUMN "projectStep" TYPE "ProjectStep" USING (
  CASE "projectStep"::text
    WHEN 'BRIEF' THEN 'PREPARATION_V1'
    WHEN 'MAQUETTE' THEN 'PRESENTATION_V1'
    WHEN 'DEVELOPPEMENT' THEN 'PEAUFINEMENT'
    WHEN 'MISE_EN_LIGNE' THEN 'LIVRAISON'
    ELSE 'PREPARATION_V1'
  END
)::"ProjectStep";
ALTER TABLE "Site" ALTER COLUMN "projectStep" SET DEFAULT 'PREPARATION_V1';
DROP TYPE "ProjectStep_old";
ALTER TABLE "Site"
  ADD COLUMN "etapeAt" TIMESTAMP(3),
  ADD COLUMN "developpeurId" TEXT,
  ADD COLUMN "deadlineV1" TIMESTAMP(3),
  ADD COLUMN "deadlineV2" TIMESTAMP(3),
  ADD COLUMN "deadlineLivraison" TIMESTAMP(3);
ALTER TABLE "Site" ADD CONSTRAINT "Site_developpeurId_fkey" FOREIGN KEY ("developpeurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TYPE "ArticleStatut" AS ENUM ('A_REDIGER', 'A_PUBLIER', 'PUBLIE');
CREATE TABLE "Article" (
  "id" TEXT NOT NULL, "siteId" TEXT NOT NULL, "titre" TEXT NOT NULL, "url" TEXT,
  "statut" "ArticleStatut" NOT NULL DEFAULT 'A_REDIGER', "publieAt" TIMESTAMP(3), "auteurId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Article_siteId_statut_idx" ON "Article"("siteId", "statut");
ALTER TABLE "Article" ADD CONSTRAINT "Article_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "Activite" (
  "id" TEXT NOT NULL, "kind" TEXT NOT NULL, "texte" TEXT NOT NULL, "href" TEXT, "userId" TEXT, "clientId" TEXT, "siteId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Activite_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Activite_createdAt_idx" ON "Activite"("createdAt");
CREATE INDEX "Activite_clientId_createdAt_idx" ON "Activite"("clientId", "createdAt");
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
