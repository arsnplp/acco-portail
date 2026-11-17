-- CreateEnum
CREATE TYPE "Equipe" AS ENUM ('COMMERCIALE', 'PRODUCTION');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "equipe" "Equipe";


-- Équipe de départ : commerciaux et Direction commerciale (Bilel, Lucas) côté Commerciale ; gestionnaire (Arsène), développeurs et prestataires côté Production.
UPDATE "User" SET "equipe" = 'COMMERCIALE' WHERE "equipe" IS NULL AND ("role" = 'COMMERCIAL' OR lower("email") IN ('bilel@acco-lab.fr', 'lucas@acco-lab.fr'));
UPDATE "User" SET "equipe" = 'PRODUCTION' WHERE "equipe" IS NULL AND ("role" IN ('DEV', 'EXPERT', 'SPECIALISTE') OR lower("email") = 'arsene@acco-lab.fr');
