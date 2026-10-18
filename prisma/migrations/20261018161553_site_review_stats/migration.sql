-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "reviewAverage" DOUBLE PRECISION,
ADD COLUMN     "reviewTotal" INTEGER,
ADD COLUMN     "reviewsSyncedAt" TIMESTAMP(3);

