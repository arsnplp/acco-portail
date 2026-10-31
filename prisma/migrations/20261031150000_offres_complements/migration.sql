-- Offres complémentaires : une offre peut être le complément d'une autre (ex. Blog ↳ Site).
ALTER TABLE "Offer" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
