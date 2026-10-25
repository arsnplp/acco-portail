-- Coffre à leads : listes générées et leurs leads. Tables nouvelles uniquement.
CREATE TYPE "LeadListeStatut" AS ENUM ('GENERATION', 'PRETE', 'ERREUR', 'UTILISEE');

CREATE TABLE "LeadListe" (
  "id" TEXT NOT NULL,
  "secteur" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "demande" INTEGER NOT NULL,
  "obtenus" INTEGER NOT NULL DEFAULT 0,
  "ecartes" INTEGER NOT NULL DEFAULT 0,
  "estimationZone" INTEGER,
  "statut" "LeadListeStatut" NOT NULL DEFAULT 'GENERATION',
  "message" TEXT,
  "erreur" TEXT,
  "recherches" INTEGER NOT NULL DEFAULT 0,
  "coutUsd" DOUBLE PRECISION,
  "commercialId" TEXT,
  "auteurId" TEXT,
  "utiliseeAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadListe_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LeadListe_createdAt_idx" ON "LeadListe"("createdAt");

CREATE TABLE "Lead" (
  "id" TEXT NOT NULL,
  "listeId" TEXT NOT NULL,
  "entreprise" TEXT NOT NULL,
  "telephone" TEXT,
  "siteWeb" TEXT,
  "siren" TEXT,
  "ville" TEXT,
  "score" INTEGER,
  "donnees" JSONB NOT NULL,
  "prospectId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Lead_prospectId_key" ON "Lead"("prospectId");
CREATE INDEX "Lead_listeId_idx" ON "Lead"("listeId");
CREATE INDEX "Lead_siren_idx" ON "Lead"("siren");
CREATE INDEX "Lead_telephone_idx" ON "Lead"("telephone");

ALTER TABLE "LeadListe" ADD CONSTRAINT "LeadListe_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadListe" ADD CONSTRAINT "LeadListe_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_listeId_fkey" FOREIGN KEY ("listeId") REFERENCES "LeadListe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE SET NULL ON UPDATE CASCADE;

do $$
declare t text;
begin
  foreach t in array array['LeadListe','Lead']
  loop
    execute format('alter table public.%I enable row level security', t);
    if exists (select 1 from pg_proc where proname = 'is_admin') and exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    end if;
  end loop;
end $$;
