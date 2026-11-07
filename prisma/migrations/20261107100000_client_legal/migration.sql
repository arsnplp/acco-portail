-- Informations légales du client (génération des contrats) : SIRET, forme juridique, TVA, RCS, capital, signataire.
ALTER TABLE "Client" ADD COLUMN "siret" TEXT, ADD COLUMN "formeJuridique" TEXT, ADD COLUMN "tvaIntra" TEXT, ADD COLUMN "rcsVille" TEXT, ADD COLUMN "capitalEuros" INTEGER, ADD COLUMN "representantNom" TEXT, ADD COLUMN "representantFonction" TEXT;
