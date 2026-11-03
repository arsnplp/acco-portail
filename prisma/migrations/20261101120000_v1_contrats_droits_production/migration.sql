-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('COMMERCIAL', 'DIRECTION', 'PRODUCTION', 'ADMIN');

-- CreateEnum
CREATE TYPE "ClientStatut" AS ENUM ('ACTIF', 'SUSPENDU', 'ARCHIVE');

-- CreateEnum
CREATE TYPE "ContratStatut" AS ENUM ('BROUILLON', 'ENVOYE', 'CONSULTE', 'SIGNE', 'REFUSE', 'TERMINE');

-- CreateEnum
CREATE TYPE "MoyenPaiement" AS ENUM ('SEPA', 'CARTE', 'VIREMENT', 'LIEN', 'AUTRE');

-- CreateEnum
CREATE TYPE "BriefEtat" AS ENUM ('EN_COURS', 'ATTENDU_CLIENT', 'COMPLET', 'VALIDE');

-- CreateEnum
CREATE TYPE "ValidationType" AS ENUM ('BRIEF_COMMERCIAL', 'BRIEF_TECHNIQUE', 'MAQUETTE', 'DEROGATION_PAIEMENT_COMMERCIALE', 'DEROGATION_PAIEMENT_TECHNIQUE', 'GO_LIVE', 'EXCEPTION_TARIFAIRE', 'LIVRABLE', 'CAMPAGNE');

-- CreateEnum
CREATE TYPE "ValidationStatut" AS ENUM ('EN_ATTENTE', 'VALIDEE', 'REFUSEE');

-- CreateEnum
CREATE TYPE "TacheClientType" AS ENUM ('RELANCE', 'RDV_A_PLANIFIER', 'APPEL', 'EMAIL', 'DOCUMENT', 'MAINTENANCE', 'AUTRE');

-- CreateEnum
CREATE TYPE "TacheClientStatut" AS ENUM ('A_FAIRE', 'FAIT', 'ANNULEE');

-- CreateEnum
CREATE TYPE "CampagneStatut" AS ENUM ('BROUILLON', 'VALIDEE', 'EN_COURS', 'TERMINEE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "DestinataireStatut" AS ENUM ('EN_ATTENTE', 'ENVOYE', 'ERREUR', 'EXCLU');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "approbationClient" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consignes" TEXT,
ADD COLUMN     "demandeClient" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "logoMiniPath" TEXT,
ADD COLUMN     "logoPath" TEXT,
ADD COLUMN     "secteur" TEXT,
ADD COLUMN     "statut" "ClientStatut" NOT NULL DEFAULT 'ACTIF';

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "ProspectContact" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "optOutCommercial" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "prospectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RendezVous" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "googleEventId" TEXT,
ADD COLUMN     "meetUrl" TEXT,
ADD COLUMN     "siteId" TEXT,
ADD COLUMN     "titre" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "prospectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "contratId" TEXT,
ADD COLUMN     "goLiveAutoriseAt" TIMESTAMP(3),
ADD COLUMN     "goLiveAutoriseParId" TEXT,
ADD COLUMN     "maquetteEnvoyeeAt" TIMESTAMP(3),
ADD COLUMN     "maquetteEnvoyeeParId" TEXT,
ADD COLUMN     "receptionPath" TEXT,
ADD COLUMN     "receptionSigneeAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "contratId" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "sourceFinanciere" TEXT NOT NULL DEFAULT 'manuelle',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "droits" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "modeDefaut" "Mode";

-- CreateTable
CREATE TABLE "Contrat" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "clientId" TEXT,
    "prospectId" TEXT,
    "siteId" TEXT,
    "parentId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "statut" "ContratStatut" NOT NULL DEFAULT 'BROUILLON',
    "titre" TEXT NOT NULL,
    "formule" "Formule",
    "montantMensuelHt" INTEGER NOT NULL DEFAULT 0,
    "montantPonctuelHt" INTEGER NOT NULL DEFAULT 0,
    "moyenPaiement" "MoyenPaiement",
    "dureeMois" INTEGER NOT NULL DEFAULT 24,
    "reconductionMois" INTEGER NOT NULL DEFAULT 24,
    "preavisJours" INTEGER NOT NULL DEFAULT 30,
    "debutEngagement" TIMESTAMP(3),
    "finEngagement" TIMESTAMP(3),
    "contenu" JSONB,
    "pdfPath" TEXT,
    "pdfSha256" TEXT,
    "certificatPath" TEXT,
    "scanPath" TEXT,
    "token" TEXT NOT NULL,
    "otpHash" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "envoyeAt" TIMESTAMP(3),
    "consulteAt" TIMESTAMP(3),
    "signeAt" TIMESTAMP(3),
    "signataireNom" TEXT,
    "signataireEmail" TEXT,
    "signataireIp" TEXT,
    "signataireUa" TEXT,
    "refuseAt" TIMESTAMP(3),
    "refusMotif" TEXT,
    "premierPaiementAt" TIMESTAMP(3),
    "premierPaiementParId" TEXT,
    "premierPaiementAnnuleAt" TIMESTAMP(3),
    "impayeAt" TIMESTAMP(3),
    "impayeParId" TEXT,
    "regulariseAt" TIMESTAMP(3),
    "sourceFinanciere" TEXT NOT NULL DEFAULT 'manuelle',
    "externalId" TEXT,
    "majFinanciereAt" TIMESTAMP(3),
    "commercialId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contrat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneContrat" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "offerId" TEXT,
    "siteId" TEXT,
    "libelle" TEXT NOT NULL,
    "billing" "Billing" NOT NULL,
    "montantHt" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL DEFAULT 1,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LigneContrat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brief" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "etat" "BriefEtat" NOT NULL DEFAULT 'EN_COURS',
    "contenu" JSONB,
    "validCommercialParId" TEXT,
    "validCommercialAt" TIMESTAMP(3),
    "validTechniqueParId" TEXT,
    "validTechniqueAt" TIMESTAMP(3),
    "derogationNote" TEXT,
    "derogationParId" TEXT,
    "derogationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Validation" (
    "id" TEXT NOT NULL,
    "type" "ValidationType" NOT NULL,
    "statut" "ValidationStatut" NOT NULL DEFAULT 'EN_ATTENTE',
    "clientId" TEXT,
    "siteId" TEXT,
    "contratId" TEXT,
    "objetId" TEXT,
    "assigneId" TEXT NOT NULL,
    "delegueAId" TEXT,
    "demandeParId" TEXT,
    "commentaire" TEXT,
    "decideParId" TEXT,
    "decideAt" TIMESTAMP(3),
    "motif" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Validation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delegation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "deId" TEXT NOT NULL,
    "versId" TEXT NOT NULL,
    "debut" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "motif" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TacheClient" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "siteId" TEXT,
    "contratId" TEXT,
    "type" "TacheClientType" NOT NULL DEFAULT 'AUTRE',
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "echeance" TIMESTAMP(3),
    "statut" "TacheClientStatut" NOT NULL DEFAULT 'A_FAIRE',
    "responsableId" TEXT,
    "source" TEXT,
    "recurrence" "Recurrence" NOT NULL DEFAULT 'PONCTUEL',
    "faitAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TacheClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campagne" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "corpsHtml" TEXT NOT NULL,
    "commercial" BOOLEAN NOT NULL DEFAULT true,
    "statut" "CampagneStatut" NOT NULL DEFAULT 'BROUILLON',
    "plafond" INTEGER NOT NULL DEFAULT 50,
    "auteurId" TEXT,
    "validParId" TEXT,
    "validAt" TIMESTAMP(3),
    "envoiDebutAt" TIMESTAMP(3),
    "envoiFinAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campagne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampagneDestinataire" (
    "id" TEXT NOT NULL,
    "campagneId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contactId" TEXT,
    "email" TEXT NOT NULL,
    "statut" "DestinataireStatut" NOT NULL DEFAULT 'EN_ATTENTE',
    "gmailId" TEXT,
    "erreur" TEXT,
    "envoyeAt" TIMESTAMP(3),

    CONSTRAINT "CampagneDestinataire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "espace" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageIA" (
    "id" TEXT NOT NULL,
    "fonction" TEXT NOT NULL,
    "modele" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "coutCents" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnecteurLog" (
    "id" TEXT NOT NULL,
    "connecteur" TEXT NOT NULL,
    "niveau" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnecteurLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contrat_reference_key" ON "Contrat"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Contrat_token_key" ON "Contrat"("token");

-- CreateIndex
CREATE INDEX "Contrat_clientId_statut_idx" ON "Contrat"("clientId", "statut");

-- CreateIndex
CREATE INDEX "Contrat_prospectId_idx" ON "Contrat"("prospectId");

-- CreateIndex
CREATE INDEX "Contrat_statut_idx" ON "Contrat"("statut");

-- CreateIndex
CREATE INDEX "LigneContrat_contratId_idx" ON "LigneContrat"("contratId");

-- CreateIndex
CREATE UNIQUE INDEX "Brief_siteId_key" ON "Brief"("siteId");

-- CreateIndex
CREATE INDEX "Validation_assigneId_statut_idx" ON "Validation"("assigneId", "statut");

-- CreateIndex
CREATE INDEX "Validation_siteId_type_statut_idx" ON "Validation"("siteId", "type", "statut");

-- CreateIndex
CREATE INDEX "Delegation_versId_fin_idx" ON "Delegation"("versId", "fin");

-- CreateIndex
CREATE INDEX "Delegation_deId_fin_idx" ON "Delegation"("deId", "fin");

-- CreateIndex
CREATE INDEX "TacheClient_responsableId_statut_echeance_idx" ON "TacheClient"("responsableId", "statut", "echeance");

-- CreateIndex
CREATE INDEX "TacheClient_clientId_statut_idx" ON "TacheClient"("clientId", "statut");

-- CreateIndex
CREATE INDEX "CampagneDestinataire_campagneId_statut_idx" ON "CampagneDestinataire"("campagneId", "statut");

-- CreateIndex
CREATE INDEX "SavedView_userId_espace_idx" ON "SavedView"("userId", "espace");

-- CreateIndex
CREATE INDEX "UsageIA_createdAt_idx" ON "UsageIA"("createdAt");

-- CreateIndex
CREATE INDEX "UsageIA_fonction_createdAt_idx" ON "UsageIA"("fonction", "createdAt");

-- CreateIndex
CREATE INDEX "ConnecteurLog_connecteur_createdAt_idx" ON "ConnecteurLog"("connecteur", "createdAt");

-- CreateIndex
CREATE INDEX "ProspectContact_clientId_idx" ON "ProspectContact"("clientId");

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Contrat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneContrat" ADD CONSTRAINT "LigneContrat_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneContrat" ADD CONSTRAINT "LigneContrat_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneContrat" ADD CONSTRAINT "LigneContrat_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brief" ADD CONSTRAINT "Brief_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Validation" ADD CONSTRAINT "Validation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Validation" ADD CONSTRAINT "Validation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Validation" ADD CONSTRAINT "Validation_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Validation" ADD CONSTRAINT "Validation_assigneId_fkey" FOREIGN KEY ("assigneId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Validation" ADD CONSTRAINT "Validation_decideParId_fkey" FOREIGN KEY ("decideParId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_deId_fkey" FOREIGN KEY ("deId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_versId_fkey" FOREIGN KEY ("versId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacheClient" ADD CONSTRAINT "TacheClient_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacheClient" ADD CONSTRAINT "TacheClient_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacheClient" ADD CONSTRAINT "TacheClient_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campagne" ADD CONSTRAINT "Campagne_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampagneDestinataire" ADD CONSTRAINT "CampagneDestinataire_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampagneDestinataire" ADD CONSTRAINT "CampagneDestinataire_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageIA" ADD CONSTRAINT "UsageIA_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectContact" ADD CONSTRAINT "ProspectContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Données : section 00.3 / 00.7 du prompt maître ─────────────────────────────────────────────
-- Aircall : métadonnées d'appel seulement. On retire des échanges déjà synchronisés les enregistrements,
-- résumés IA, sujets, sentiments et transcriptions ; la note redevient un libellé neutre.
UPDATE "Echange"
SET "meta" = ("meta"::jsonb - 'resume' - 'sujets' - 'sentiment' - 'transcription' - 'analysePending' - 'enregistrement' - 'messagerie')
             || '{"enregistrement": false, "messagerie": false, "resume": null, "sujets": [], "sentiment": null, "transcription": null, "analysePending": false}'::jsonb
WHERE "meta" IS NOT NULL AND "meta"::jsonb ->> 'source' = 'aircall';
UPDATE "Echange"
SET "notes" = CASE
  WHEN ("meta"::jsonb ->> 'repondu') = 'true' THEN concat('Appel ', CASE WHEN ("meta"::jsonb ->> 'direction') = 'outbound' THEN 'sortant' ELSE 'entrant' END, ' (Aircall)')
  WHEN ("meta"::jsonb ->> 'direction') = 'inbound' THEN 'Appel entrant manqué (Aircall)'
  ELSE 'Appel sans réponse (Aircall)' END
WHERE "origine" = 'aircall' AND "meta" IS NOT NULL;
-- Contacts : les contacts des fiches prospect liées à un client deviennent aussi contacts du client (une seule source).
UPDATE "ProspectContact" pc SET "clientId" = p."clientId" FROM "Prospect" p WHERE pc."prospectId" = p."id" AND p."clientId" IS NOT NULL AND pc."clientId" IS NULL;
-- Interrupteurs IA : désactivés par défaut (00.6). Les valeurs déjà enregistrées sont conservées.
INSERT INTO "Setting" ("key", "value", "updatedAt") VALUES ('feature_ai', 'false', now()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "Setting" ("key", "value", "updatedAt") VALUES ('ia_plafond_cents', '2000', now()) ON CONFLICT ("key") DO NOTHING;

-- Kanban Production : les six libellés exacts du prompt maître (10.2).
ALTER TYPE "ProjectStep" RENAME TO "ProjectStep_old";
CREATE TYPE "ProjectStep" AS ENUM ('CREER_MAQUETTE', 'VALIDER_MAQUETTE', 'MODIFIER', 'VALIDER_MODIFICATION', 'FINIR', 'A_LIVRER');
ALTER TABLE "Site" ALTER COLUMN "projectStep" DROP DEFAULT;
ALTER TABLE "Site" ALTER COLUMN "projectStep" TYPE "ProjectStep" USING (
  CASE "projectStep"::text
    WHEN 'MAQUETTE' THEN 'CREER_MAQUETTE'
    WHEN 'ATTENTE_VALIDATION' THEN 'VALIDER_MAQUETTE'
    WHEN 'MODIFICATION' THEN 'MODIFIER'
    WHEN 'ATTENTE_VALIDATION_FINITION' THEN 'VALIDER_MODIFICATION'
    WHEN 'A_LIVRER' THEN 'A_LIVRER'
    ELSE 'CREER_MAQUETTE'
  END
)::"ProjectStep";
ALTER TABLE "Site" ALTER COLUMN "projectStep" SET DEFAULT 'CREER_MAQUETTE';
DROP TYPE "ProjectStep_old";

-- Notification « maquette disponible » (10.4 : visible seulement après le clic « Envoyer maquette »)
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'MAQUETTE_DISPONIBLE';
