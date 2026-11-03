CREATE TABLE "RetourCreation" (
  "id" TEXT NOT NULL, "siteId" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "texte" TEXT NOT NULL, "page" TEXT, "fait" BOOLEAN NOT NULL DEFAULT false, "faitAt" TIMESTAMP(3), "auteurId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RetourCreation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RetourCreation_siteId_fait_idx" ON "RetourCreation"("siteId", "fait");
ALTER TABLE "RetourCreation" ADD CONSTRAINT "RetourCreation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
