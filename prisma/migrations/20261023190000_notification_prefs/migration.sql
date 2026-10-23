-- Réglages de notifications : documents (client et équipe) et recommandations (équipe)
ALTER TABLE "NotificationPreference"
  ADD COLUMN "documents" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "referrals" BOOLEAN NOT NULL DEFAULT true;
