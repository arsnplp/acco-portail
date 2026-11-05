-- Signalements de la Direction au commercial attitré d'une fiche prospect (demande d'infos ou de rectification).
CREATE TABLE "Signalement" (
    "id" TEXT NOT NULL,
    "prospectId" TEXT NOT NULL,
    "deId" TEXT,
    "versId" TEXT,
    "message" TEXT NOT NULL,
    "luAt" TIMESTAMP(3),
    "traiteAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Signalement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Signalement_versId_luAt_idx" ON "Signalement"("versId", "luAt");
CREATE INDEX "Signalement_prospectId_traiteAt_idx" ON "Signalement"("prospectId", "traiteAt");
ALTER TABLE "Signalement" ADD CONSTRAINT "Signalement_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Signalement" ADD CONSTRAINT "Signalement_deId_fkey" FOREIGN KEY ("deId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Signalement" ADD CONSTRAINT "Signalement_versId_fkey" FOREIGN KEY ("versId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
