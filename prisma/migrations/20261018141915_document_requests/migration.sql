-- CreateEnum
CREATE TYPE "DocumentRequestStatus" AS ENUM ('EN_ATTENTE', 'TERMINEE');

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'DOCUMENT_DISPONIBLE';

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "siteId" TEXT,
    "kind" "DocumentKind" NOT NULL,
    "message" TEXT,
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "requestedBy" TEXT,
    "documentId" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRequest_documentId_key" ON "DocumentRequest"("documentId");

-- CreateIndex
CREATE INDEX "DocumentRequest_clientId_status_idx" ON "DocumentRequest"("clientId", "status");

-- CreateIndex
CREATE INDEX "DocumentRequest_status_idx" ON "DocumentRequest"("status");

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentRequest" ADD CONSTRAINT "DocumentRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- RLS pour les demandes de document
ALTER TABLE "DocumentRequest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_all   ON "DocumentRequest" FOR ALL    TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY member_read ON "DocumentRequest" FOR SELECT TO authenticated USING ("clientId" IN (SELECT public.my_client_ids()));
