-- Pipeline de production : Maquette → Attente de validation → Modification → Attente de validation et finition → À livrer ; Livré = site en ligne.
ALTER TYPE "ProjectStep" RENAME TO "ProjectStep_old";
CREATE TYPE "ProjectStep" AS ENUM ('MAQUETTE', 'ATTENTE_VALIDATION', 'MODIFICATION', 'ATTENTE_VALIDATION_FINITION', 'A_LIVRER');
ALTER TABLE "Site" ALTER COLUMN "projectStep" DROP DEFAULT;
ALTER TABLE "Site" ALTER COLUMN "projectStep" TYPE "ProjectStep" USING (
  CASE "projectStep"::text
    WHEN 'PREPARATION_V1' THEN 'MAQUETTE'
    WHEN 'PRESENTATION_V1' THEN 'ATTENTE_VALIDATION'
    WHEN 'PEAUFINEMENT' THEN 'MODIFICATION'
    WHEN 'VALIDATION_CLIENT' THEN 'ATTENTE_VALIDATION_FINITION'
    WHEN 'FINITION' THEN 'A_LIVRER'
    WHEN 'LIVRAISON' THEN 'A_LIVRER'
    ELSE 'MAQUETTE'
  END
)::"ProjectStep";
ALTER TABLE "Site" ALTER COLUMN "projectStep" SET DEFAULT 'MAQUETTE';
DROP TYPE "ProjectStep_old";
