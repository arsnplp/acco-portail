-- Colonne « À valider » + suivi Claude Code + dépôt GitHub des sites
ALTER TYPE "ChangeRequestStatus" ADD VALUE IF NOT EXISTS 'A_VALIDER' BEFORE 'TERMINEE';

CREATE TYPE "ClaudeJobState" AS ENUM ('EN_FILE', 'EN_TRAVAIL', 'PRET', 'MISE_EN_LIGNE_DEMANDEE', 'EN_LIGNE', 'ERREUR');

ALTER TABLE "Site"
  ADD COLUMN "repoUrl" TEXT,
  ADD COLUMN "repoBranch" TEXT,
  ADD COLUMN "repoRoot" TEXT;

ALTER TABLE "ChangeRequest"
  ADD COLUMN "claudeState" "ClaudeJobState",
  ADD COLUMN "claudeBranch" TEXT,
  ADD COLUMN "claudeSummary" TEXT,
  ADD COLUMN "claudeFeedback" TEXT,
  ADD COLUMN "claudeError" TEXT,
  ADD COLUMN "claudePreviewUrl" TEXT,
  ADD COLUMN "claudeCompareUrl" TEXT,
  ADD COLUMN "claudeStartedAt" TIMESTAMP(3),
  ADD COLUMN "claudeFinishedAt" TIMESTAMP(3),
  ADD COLUMN "claudeMergedAt" TIMESTAMP(3);

CREATE INDEX "ChangeRequest_claudeState_idx" ON "ChangeRequest"("claudeState");
