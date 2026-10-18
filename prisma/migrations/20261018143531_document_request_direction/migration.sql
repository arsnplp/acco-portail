-- CreateEnum
CREATE TYPE "DocumentRequestDirection" AS ENUM ('VERS_EQUIPE', 'VERS_CLIENT');

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'DOCUMENT_DEMANDE';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "uploadedByClient" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DocumentRequest" ADD COLUMN     "direction" "DocumentRequestDirection" NOT NULL DEFAULT 'VERS_EQUIPE';

