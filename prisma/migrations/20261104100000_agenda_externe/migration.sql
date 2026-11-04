CREATE TABLE "AgendaExterne" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "googleEventId" TEXT NOT NULL, "titre" TEXT NOT NULL, "debut" TIMESTAMP(3) NOT NULL, "fin" TIMESTAMP(3) NOT NULL,
  "jour" BOOLEAN NOT NULL DEFAULT false, "lieu" TEXT, "meetUrl" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgendaExterne_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AgendaExterne_userId_googleEventId_key" ON "AgendaExterne"("userId", "googleEventId");
CREATE INDEX "AgendaExterne_userId_debut_idx" ON "AgendaExterne"("userId", "debut");
ALTER TABLE "AgendaExterne" ADD CONSTRAINT "AgendaExterne_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
