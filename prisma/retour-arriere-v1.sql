-- Retour arrière de la migration 20261101120000_v1_contrats_droits_production (à n'exécuter qu'en cas de besoin, après sauvegarde).
-- Remet les étapes du kanban aux anciens libellés et supprime les objets V1. Les données V1 (contrats, briefs, validations…) sont perdues.
BEGIN;
ALTER TYPE "ProjectStep" RENAME TO "ProjectStep_v1";
CREATE TYPE "ProjectStep" AS ENUM ('MAQUETTE', 'ATTENTE_VALIDATION', 'MODIFICATION', 'ATTENTE_VALIDATION_FINITION', 'A_LIVRER');
ALTER TABLE "Site" ALTER COLUMN "projectStep" DROP DEFAULT;
ALTER TABLE "Site" ALTER COLUMN "projectStep" TYPE "ProjectStep" USING (
  CASE "projectStep"::text
    WHEN 'CREER_MAQUETTE' THEN 'MAQUETTE' WHEN 'VALIDER_MAQUETTE' THEN 'ATTENTE_VALIDATION' WHEN 'MODIFIER' THEN 'MODIFICATION'
    WHEN 'VALIDER_MODIFICATION' THEN 'ATTENTE_VALIDATION_FINITION' WHEN 'FINIR' THEN 'ATTENTE_VALIDATION_FINITION' ELSE 'A_LIVRER' END)::"ProjectStep";
ALTER TABLE "Site" ALTER COLUMN "projectStep" SET DEFAULT 'MAQUETTE';
DROP TYPE "ProjectStep_v1";
DROP TABLE IF EXISTS "CampagneDestinataire", "Campagne", "Charge", "ConnecteurLog", "UsageIA", "SavedView", "TacheClient", "Delegation", "Validation", "Brief", "LigneContrat", "Contrat" CASCADE;
ALTER TABLE "User" DROP COLUMN IF EXISTS "droits", DROP COLUMN IF EXISTS "modeDefaut";
ALTER TABLE "Client" DROP COLUMN IF EXISTS "logoPath", DROP COLUMN IF EXISTS "logoMiniPath", DROP COLUMN IF EXISTS "secteur", DROP COLUMN IF EXISTS "statut", DROP COLUMN IF EXISTS "archivedAt";
ALTER TABLE "ProspectContact" DROP COLUMN IF EXISTS "clientId", DROP COLUMN IF EXISTS "optOutCommercial";
ALTER TABLE "RendezVous" DROP COLUMN IF EXISTS "clientId", DROP COLUMN IF EXISTS "siteId", DROP COLUMN IF EXISTS "titre", DROP COLUMN IF EXISTS "meetUrl", DROP COLUMN IF EXISTS "googleEventId";
ALTER TABLE "Site" DROP COLUMN IF EXISTS "version", DROP COLUMN IF EXISTS "maquetteEnvoyeeAt", DROP COLUMN IF EXISTS "maquetteEnvoyeeParId", DROP COLUMN IF EXISTS "goLiveAutoriseAt", DROP COLUMN IF EXISTS "goLiveAutoriseParId", DROP COLUMN IF EXISTS "receptionPath", DROP COLUMN IF EXISTS "receptionSigneeAt", DROP COLUMN IF EXISTS "contratId";
ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "contratId", DROP COLUMN IF EXISTS "sourceFinanciere", DROP COLUMN IF EXISTS "externalId";
ALTER TABLE "Article" DROP COLUMN IF EXISTS "demandeClient", DROP COLUMN IF EXISTS "consignes", DROP COLUMN IF EXISTS "approbationClient";
DROP TYPE IF EXISTS "Mode", "ClientStatut", "ContratStatut", "MoyenPaiement", "BriefEtat", "ValidationType", "ValidationStatut", "TacheClientType", "TacheClientStatut", "CampagneStatut", "DestinataireStatut", "ChargeType";
DELETE FROM "_prisma_migrations" WHERE migration_name = '20261101120000_v1_contrats_droits_production';
COMMIT;
-- Les métadonnées Aircall purgées (résumés, transcriptions) et les notes neutralisées ne sont pas restaurées par ce script :
-- elles sont dans la sauvegarde JSON ~/acco-portail-sauvegarde-2026-11-03/echanges.json.
