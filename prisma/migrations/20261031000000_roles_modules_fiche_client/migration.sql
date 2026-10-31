-- Rôles par module (Direction, Commercial, Développeur, Expert, Spécialiste, Client), fiche client centralisée, journal des connexions.
ALTER TYPE "Role" ADD VALUE 'DEV';
ALTER TYPE "Role" ADD VALUE 'EXPERT';
ALTER TYPE "Role" ADD VALUE 'SPECIALISTE';
CREATE TYPE "Formule" AS ENUM ('ESSENTIEL', 'REFERENCE', 'CONQUETE', 'SIGNATURE');
ALTER TABLE "Client"
  ADD COLUMN "commercialId" TEXT,
  ADD COLUMN "developpeurId" TEXT,
  ADD COLUMN "formule" "Formule",
  ADD COLUMN "engagementDebut" TIMESTAMP(3),
  ADD COLUMN "engagementFin" TIMESTAMP(3),
  ADD COLUMN "gmbUrl" TEXT,
  ADD COLUMN "reference" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD CONSTRAINT "Client_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_developpeurId_fkey" FOREIGN KEY ("developpeurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "LoginLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientId" TEXT,
  "userAgent" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LoginLog_clientId_at_idx" ON "LoginLog"("clientId", "at");
CREATE INDEX "LoginLog_userId_at_idx" ON "LoginLog"("userId", "at");
ALTER TABLE "LoginLog" ADD CONSTRAINT "LoginLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoginLog" ADD CONSTRAINT "LoginLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
