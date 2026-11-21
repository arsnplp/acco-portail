-- La charte graphique (DA) devient un récapitulatif par site rédigé par l'équipe (plus de saisie client, plus de lien au client).
DROP TABLE IF EXISTS "ChartePiece";
DROP TABLE IF EXISTS "Charte";
CREATE TABLE "Charte" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "contenu" JSONB,
    "publieeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Charte_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ChartePiece" (
    "id" TEXT NOT NULL,
    "charteId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChartePiece_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Charte_siteId_key" ON "Charte"("siteId");
CREATE INDEX "ChartePiece_charteId_idx" ON "ChartePiece"("charteId");
ALTER TABLE "Charte" ADD CONSTRAINT "Charte_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChartePiece" ADD CONSTRAINT "ChartePiece_charteId_fkey" FOREIGN KEY ("charteId") REFERENCES "Charte"("id") ON DELETE CASCADE ON UPDATE CASCADE;
