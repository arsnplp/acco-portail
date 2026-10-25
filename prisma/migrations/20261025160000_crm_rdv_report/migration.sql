-- Report d'un RDV après un no show : le nouveau RDV pointe vers celui qui n'a pas eu lieu
-- et ne compte pas comme un RDV pris dans les stats.
ALTER TABLE "RendezVous" ADD COLUMN "reportDeId" TEXT;
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_reportDeId_fkey" FOREIGN KEY ("reportDeId") REFERENCES "RendezVous"("id") ON DELETE SET NULL ON UPDATE CASCADE;
