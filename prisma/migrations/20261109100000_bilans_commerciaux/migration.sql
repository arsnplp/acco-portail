-- Bilans individuels des commerciaux : objectifs (personnel, engagement, fixé) par indicateur et période, comptes rendus.
CREATE TYPE "PeriodeBilan" AS ENUM ('HEBDO', 'MENSUEL', 'TRIMESTRIEL', 'ANNUEL');
CREATE TABLE "ObjectifCommercial" (
    "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "periode" "PeriodeBilan" NOT NULL, "debut" TIMESTAMP(3) NOT NULL, "indicateur" TEXT NOT NULL,
    "personnel" INTEGER, "engagement" INTEGER, "fixe" INTEGER, "fixeParId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ObjectifCommercial_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ObjectifCommercial_userId_periode_debut_indicateur_key" ON "ObjectifCommercial"("userId", "periode", "debut", "indicateur");
CREATE TABLE "BilanCommercial" (
    "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "periode" "PeriodeBilan" NOT NULL, "debut" TIMESTAMP(3) NOT NULL, "contenu" TEXT NOT NULL, "auteurId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BilanCommercial_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BilanCommercial_userId_periode_debut_idx" ON "BilanCommercial"("userId", "periode", "debut");
