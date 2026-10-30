-- Compte Google personnel par membre de l'équipe (lecture Gmail pour le CRM).
ALTER TABLE "User" ADD COLUMN "googleRefreshToken" TEXT, ADD COLUMN "googleEmail" TEXT;
