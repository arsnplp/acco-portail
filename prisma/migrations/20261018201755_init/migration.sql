-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('EN_CREATION', 'EN_LIGNE', 'SUSPENDU');

-- CreateEnum
CREATE TYPE "ProjectStep" AS ENUM ('BRIEF', 'MAQUETTE', 'DEVELOPPEMENT', 'MISE_EN_LIGNE');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('LOGO', 'TEXTE', 'PHOTO', 'AUTRE');

-- CreateEnum
CREATE TYPE "HistoryKind" AS ENUM ('CREATION', 'INTERVENTION', 'MISE_EN_LIGNE');

-- CreateEnum
CREATE TYPE "ContactRequestStatus" AS ENUM ('NOUVELLE', 'TRAITEE', 'DEVENU_CLIENT');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('RECUE', 'EN_COURS', 'TERMINEE');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('NORMALE', 'URGENTE');

-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('GOOGLE', 'DEMO');

-- CreateEnum
CREATE TYPE "Module" AS ENUM ('NONE', 'AVIS');

-- CreateEnum
CREATE TYPE "Billing" AS ENUM ('PONCTUEL', 'MENSUEL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('A_TRAITER', 'VALIDEE', 'REFUSEE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIF', 'RESILIE');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('CONTRAT', 'FACTURE', 'DEVIS', 'AUTRE');

-- CreateEnum
CREATE TYPE "ReferralKind" AS ENUM ('LIEN', 'CONTACT');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('ENVOYEE', 'CONTACTEE', 'SIGNEE', 'RECOMPENSE_VALIDEE');

-- CreateEnum
CREATE TYPE "ReviewPromptState" AS ENUM ('AFFICHEE', 'IGNOREE', 'CLIQUEE');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('DEMANDE_CONTACT', 'NOUVEL_AVIS', 'MODIFICATION_TERMINEE', 'RECAP_MENSUEL', 'MESSAGE_EQUIPE', 'SITE_EN_LIGNE', 'COMMANDE_VALIDEE', 'RECOMPENSE_PARRAINAGE', 'ALERTE_SITE');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "siren" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "referralCode" TEXT NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientMembership" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "invitedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "previewUrl" TEXT,
    "screenshotUrl" TEXT,
    "status" "SiteStatus" NOT NULL DEFAULT 'EN_CREATION',
    "projectStep" "ProjectStep" NOT NULL DEFAULT 'BRIEF',
    "mockupValidatedAt" TIMESTAMP(3),
    "launchedAt" TIMESTAMP(3),
    "siteKey" TEXT NOT NULL,
    "searchConsoleProp" TEXT,
    "googleLocationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteAsset" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "label" TEXT NOT NULL,
    "storagePath" TEXT,
    "fileName" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteHistoryEntry" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "kind" "HistoryKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "items" TEXT[],
    "happenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteHistoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteHealthCheck" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "isUp" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "responseMs" INTEGER,
    "sslExpiresAt" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteHealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "type" TEXT,
    "message" TEXT NOT NULL,
    "pageUrl" TEXT,
    "status" "ContactRequestStatus" NOT NULL DEFAULT 'NOUVELLE',
    "handledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchStatsMonthly" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "topQueries" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchStatsMonthly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyRecap" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "contactCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "isPositive" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyRecap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "source" "ReviewSource" NOT NULL DEFAULT 'DEMO',
    "externalId" TEXT,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "suggestedReply" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "page" TEXT,
    "urgency" "Urgency" NOT NULL DEFAULT 'NORMALE',
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'RECUE',
    "assigneeId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequestAttachment" (
    "id" TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeRequestAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequestComment" (
    "id" TEXT NOT NULL,
    "changeRequestId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeRequestComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guide" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "emoji" TEXT,
    "title" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "steps" TEXT[],
    "offerId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuideProgress" (
    "id" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "checkedSteps" INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "benefit" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "setupCents" INTEGER,
    "billing" "Billing" NOT NULL,
    "module" "Module" NOT NULL DEFAULT 'NONE',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "promoPriceCents" INTEGER,
    "percentOff" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "siteId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'A_TRAITER',
    "note" TEXT,
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "siteId" TEXT,
    "offerId" TEXT,
    "label" TEXT NOT NULL,
    "module" "Module" NOT NULL DEFAULT 'NONE',
    "billing" "Billing" NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "monthlyQuota" INTEGER,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIF',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commitmentEndsAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "clientReadAt" TIMESTAMP(3),
    "teamReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT,
    "siteId" TEXT,
    "body" TEXT NOT NULL,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "siteId" TEXT,
    "kind" "DocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerClientId" TEXT NOT NULL,
    "kind" "ReferralKind" NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "note" TEXT,
    "referredClientId" TEXT,
    "status" "ReferralStatus" NOT NULL DEFAULT 'ENVOYEE',
    "rewardLabel" TEXT,
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewPrompt" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "state" "ReviewPromptState" NOT NULL DEFAULT 'AFFICHEE',
    "shownAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "siteId" TEXT,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "contactRequests" BOOLEAN NOT NULL DEFAULT true,
    "reviews" BOOLEAN NOT NULL DEFAULT true,
    "changes" BOOLEAN NOT NULL DEFAULT true,
    "recaps" BOOLEAN NOT NULL DEFAULT true,
    "messages" BOOLEAN NOT NULL DEFAULT true,
    "offers" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_referralCode_key" ON "Client"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ClientMembership_userId_idx" ON "ClientMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientMembership_clientId_userId_key" ON "ClientMembership"("clientId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_clientId_idx" ON "Invitation"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Site_siteKey_key" ON "Site"("siteKey");

-- CreateIndex
CREATE INDEX "Site_clientId_idx" ON "Site"("clientId");

-- CreateIndex
CREATE INDEX "SiteAsset_siteId_idx" ON "SiteAsset"("siteId");

-- CreateIndex
CREATE INDEX "SiteHistoryEntry_siteId_happenedAt_idx" ON "SiteHistoryEntry"("siteId", "happenedAt");

-- CreateIndex
CREATE INDEX "SiteHealthCheck_siteId_checkedAt_idx" ON "SiteHealthCheck"("siteId", "checkedAt");

-- CreateIndex
CREATE INDEX "ContactRequest_siteId_createdAt_idx" ON "ContactRequest"("siteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SearchStatsMonthly_siteId_year_month_key" ON "SearchStatsMonthly"("siteId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyRecap_siteId_year_month_key" ON "MonthlyRecap"("siteId", "year", "month");

-- CreateIndex
CREATE INDEX "Review_siteId_publishedAt_idx" ON "Review"("siteId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_siteId_externalId_key" ON "Review"("siteId", "externalId");

-- CreateIndex
CREATE INDEX "ChangeRequest_siteId_status_idx" ON "ChangeRequest"("siteId", "status");

-- CreateIndex
CREATE INDEX "ChangeRequest_status_idx" ON "ChangeRequest"("status");

-- CreateIndex
CREATE INDEX "ChangeRequestAttachment_changeRequestId_idx" ON "ChangeRequestAttachment"("changeRequestId");

-- CreateIndex
CREATE INDEX "ChangeRequestComment_changeRequestId_idx" ON "ChangeRequestComment"("changeRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Guide_slug_key" ON "Guide"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GuideProgress_guideId_siteId_key" ON "GuideProgress"("guideId", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_slug_key" ON "Offer"("slug");

-- CreateIndex
CREATE INDEX "Promotion_endsAt_idx" ON "Promotion"("endsAt");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_clientId_idx" ON "Order"("clientId");

-- CreateIndex
CREATE INDEX "Subscription_clientId_idx" ON "Subscription"("clientId");

-- CreateIndex
CREATE INDEX "Subscription_siteId_module_status_idx" ON "Subscription"("siteId", "module", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_clientId_key" ON "Conversation"("clientId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Document_clientId_idx" ON "Document"("clientId");

-- CreateIndex
CREATE INDEX "Document_siteId_idx" ON "Document"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredClientId_key" ON "Referral"("referredClientId");

-- CreateIndex
CREATE INDEX "Referral_referrerClientId_idx" ON "Referral"("referrerClientId");

-- CreateIndex
CREATE INDEX "ReviewPrompt_clientId_shownAt_idx" ON "ReviewPrompt"("clientId", "shownAt");

-- CreateIndex
CREATE INDEX "Notification_clientId_createdAt_idx" ON "Notification"("clientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "ClientMembership" ADD CONSTRAINT "ClientMembership_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientMembership" ADD CONSTRAINT "ClientMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteAsset" ADD CONSTRAINT "SiteAsset_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteHistoryEntry" ADD CONSTRAINT "SiteHistoryEntry_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteHistoryEntry" ADD CONSTRAINT "SiteHistoryEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteHealthCheck" ADD CONSTRAINT "SiteHealthCheck_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactRequest" ADD CONSTRAINT "ContactRequest_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchStatsMonthly" ADD CONSTRAINT "SearchStatsMonthly_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyRecap" ADD CONSTRAINT "MonthlyRecap_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequestAttachment" ADD CONSTRAINT "ChangeRequestAttachment_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequestComment" ADD CONSTRAINT "ChangeRequestComment_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequestComment" ADD CONSTRAINT "ChangeRequestComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guide" ADD CONSTRAINT "Guide_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuideProgress" ADD CONSTRAINT "GuideProgress_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "Guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuideProgress" ADD CONSTRAINT "GuideProgress_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerClientId_fkey" FOREIGN KEY ("referrerClientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredClientId_fkey" FOREIGN KEY ("referredClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPrompt" ADD CONSTRAINT "ReviewPrompt_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
