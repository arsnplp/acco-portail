-- Filtres de génération : mobiles uniquement, avec ou sans site.
ALTER TABLE "LeadListe" ADD COLUMN "mobileSeul" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "filtreSite" TEXT;
