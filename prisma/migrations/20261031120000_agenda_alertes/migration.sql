-- Synchronisation Google Agenda par membre et alerte « aucun contact depuis 60 jours ».
ALTER TABLE "Client" ADD COLUMN "alerteContactAt" TIMESTAMP(3);
CREATE TABLE "AgendaEvent" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "cle" TEXT NOT NULL, "googleEventId" TEXT NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgendaEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AgendaEvent_userId_cle_key" ON "AgendaEvent"("userId", "cle");
ALTER TABLE "AgendaEvent" ADD CONSTRAINT "AgendaEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
