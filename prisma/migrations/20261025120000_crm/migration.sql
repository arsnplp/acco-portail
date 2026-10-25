-- Espace Commercial (CRM) : prospection et production. Tables nouvelles uniquement,
-- plus un rôle COMMERCIAL ; aucune colonne existante n'est modifiée.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'COMMERCIAL';

CREATE TYPE "ProspectStatut" AS ENUM ('A_CONTACTER', 'A_RELANCER', 'POSER_RDV', 'RDV_POSE', 'A_SIGNER', 'GAGNE', 'PERDU');
CREATE TYPE "ProspectSource" AS ENUM ('COLD_CALL', 'PROSPECTION_PHYSIQUE', 'RECOMMANDATION', 'SITE_WEB', 'AUTRE');
CREATE TYPE "EchangeType" AS ENUM ('NRP', 'APPEL', 'MAIL', 'PP', 'RDV', 'PRISE_RDV', 'NOTE');
CREATE TYPE "RdvResultat" AS ENUM ('PREVU', 'FAIT', 'ANNULE');
CREATE TYPE "Priorite" AS ENUM ('BASSE', 'MOYENNE', 'HAUTE');
CREATE TYPE "ProjetStatut" AS ENUM ('A_FAIRE', 'EN_COURS', 'EN_PAUSE', 'TERMINE');
CREATE TYPE "TacheStatut" AS ENUM ('A_FAIRE', 'EN_COURS', 'FAIT');
CREATE TYPE "Recurrence" AS ENUM ('PONCTUEL', 'HEBDOMADAIRE', 'MENSUEL_FIXE', 'MENSUEL_RELATIF');

CREATE TABLE "Cible" (
  "id" TEXT NOT NULL,
  "nom" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Cible_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Cible_nom_key" ON "Cible"("nom");

CREATE TABLE "Prospect" (
  "id" TEXT NOT NULL,
  "legacyId" TEXT,
  "societe" TEXT NOT NULL,
  "siren" TEXT,
  "siret" TEXT,
  "dirigeant" TEXT,
  "adresse" TEXT,
  "siteWeb" TEXT,
  "telephone" TEXT,
  "cibleId" TEXT,
  "source" "ProspectSource",
  "statut" "ProspectStatut" NOT NULL DEFAULT 'A_CONTACTER',
  "motifPerte" TEXT,
  "potentielEuros" INTEGER,
  "fraisCreationEuros" INTEGER,
  "mensuelEuros" INTEGER,
  "commercialId" TEXT,
  "relanceAt" TIMESTAMP(3),
  "clientId" TEXT,
  "gagneAt" TIMESTAMP(3),
  "perduAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Prospect_legacyId_key" ON "Prospect"("legacyId");
CREATE UNIQUE INDEX "Prospect_clientId_key" ON "Prospect"("clientId");
CREATE INDEX "Prospect_statut_relanceAt_idx" ON "Prospect"("statut", "relanceAt");
CREATE INDEX "Prospect_commercialId_idx" ON "Prospect"("commercialId");
CREATE INDEX "Prospect_siren_idx" ON "Prospect"("siren");
CREATE INDEX "Prospect_telephone_idx" ON "Prospect"("telephone");

CREATE TABLE "ProspectContact" (
  "id" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "prenom" TEXT,
  "nom" TEXT,
  "fonction" TEXT,
  "email" TEXT,
  "telephone" TEXT,
  "principal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProspectContact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProspectContact_prospectId_idx" ON "ProspectContact"("prospectId");

CREATE TABLE "Echange" (
  "id" TEXT NOT NULL,
  "legacyId" TEXT,
  "prospectId" TEXT,
  "clientId" TEXT,
  "type" "EchangeType" NOT NULL,
  "notes" TEXT,
  "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "auteurId" TEXT,
  "auteurNom" TEXT,
  "origine" TEXT NOT NULL DEFAULT 'saisie',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Echange_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Echange_legacyId_key" ON "Echange"("legacyId");
CREATE INDEX "Echange_prospectId_date_idx" ON "Echange"("prospectId", "date");
CREATE INDEX "Echange_clientId_date_idx" ON "Echange"("clientId", "date");
CREATE INDEX "Echange_auteurId_date_idx" ON "Echange"("auteurId", "date");

CREATE TABLE "RendezVous" (
  "id" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "commercialId" TEXT,
  "debut" TIMESTAMP(3) NOT NULL,
  "dureeMin" INTEGER NOT NULL DEFAULT 60,
  "lieu" TEXT,
  "resultat" "RdvResultat" NOT NULL DEFAULT 'PREVU',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RendezVous_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RendezVous_debut_idx" ON "RendezVous"("debut");

CREATE TABLE "ProjetModele" (
  "id" TEXT NOT NULL,
  "legacyId" TEXT,
  "nom" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjetModele_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProjetModele_legacyId_key" ON "ProjetModele"("legacyId");

CREATE TABLE "TacheModele" (
  "id" TEXT NOT NULL,
  "legacyId" TEXT,
  "modeleId" TEXT NOT NULL,
  "titre" TEXT NOT NULL,
  "description" TEXT,
  "responsableId" TEXT,
  "priorite" "Priorite" NOT NULL DEFAULT 'MOYENNE',
  "recurrence" "Recurrence" NOT NULL DEFAULT 'PONCTUEL',
  "jourSemaine" INTEGER,
  "jourMois" INTEGER,
  "positionMois" INTEGER,
  "delaiJours" INTEGER NOT NULL DEFAULT 0,
  "ordre" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "TacheModele_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TacheModele_legacyId_key" ON "TacheModele"("legacyId");
CREATE INDEX "TacheModele_modeleId_idx" ON "TacheModele"("modeleId");

CREATE TABLE "SousTacheModele" (
  "id" TEXT NOT NULL,
  "legacyId" TEXT,
  "tacheId" TEXT NOT NULL,
  "intitule" TEXT NOT NULL,
  "ordre" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SousTacheModele_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SousTacheModele_legacyId_key" ON "SousTacheModele"("legacyId");
CREATE INDEX "SousTacheModele_tacheId_idx" ON "SousTacheModele"("tacheId");

CREATE TABLE "Projet" (
  "id" TEXT NOT NULL,
  "legacyId" TEXT,
  "clientId" TEXT,
  "siteId" TEXT,
  "modeleId" TEXT,
  "nom" TEXT NOT NULL,
  "description" TEXT,
  "statut" "ProjetStatut" NOT NULL DEFAULT 'EN_COURS',
  "priorite" "Priorite" NOT NULL DEFAULT 'MOYENNE',
  "debut" TIMESTAMP(3),
  "echeance" TIMESTAMP(3),
  "responsableId" TEXT,
  "brief" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Projet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Projet_legacyId_key" ON "Projet"("legacyId");
CREATE INDEX "Projet_clientId_idx" ON "Projet"("clientId");

CREATE TABLE "Tache" (
  "id" TEXT NOT NULL,
  "legacyId" TEXT,
  "projetId" TEXT,
  "modeleId" TEXT,
  "titre" TEXT NOT NULL,
  "description" TEXT,
  "responsableId" TEXT,
  "statut" "TacheStatut" NOT NULL DEFAULT 'A_FAIRE',
  "priorite" "Priorite" NOT NULL DEFAULT 'MOYENNE',
  "debut" TIMESTAMP(3),
  "echeance" TIMESTAMP(3),
  "faitLe" TIMESTAMP(3),
  "recurrence" "Recurrence" NOT NULL DEFAULT 'PONCTUEL',
  "jourSemaine" INTEGER,
  "jourMois" INTEGER,
  "positionMois" INTEGER,
  "ordre" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Tache_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Tache_legacyId_key" ON "Tache"("legacyId");
CREATE INDEX "Tache_responsableId_statut_echeance_idx" ON "Tache"("responsableId", "statut", "echeance");
CREATE INDEX "Tache_projetId_idx" ON "Tache"("projetId");

CREATE TABLE "SousTache" (
  "id" TEXT NOT NULL,
  "legacyId" TEXT,
  "tacheId" TEXT NOT NULL,
  "titre" TEXT NOT NULL,
  "fait" BOOLEAN NOT NULL DEFAULT false,
  "ordre" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SousTache_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SousTache_legacyId_key" ON "SousTache"("legacyId");
CREATE INDEX "SousTache_tacheId_idx" ON "SousTache"("tacheId");

ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_cibleId_fkey" FOREIGN KEY ("cibleId") REFERENCES "Cible"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProspectContact" ADD CONSTRAINT "ProspectContact_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Echange" ADD CONSTRAINT "Echange_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Echange" ADD CONSTRAINT "Echange_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Echange" ADD CONSTRAINT "Echange_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RendezVous" ADD CONSTRAINT "RendezVous_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TacheModele" ADD CONSTRAINT "TacheModele_modeleId_fkey" FOREIGN KEY ("modeleId") REFERENCES "ProjetModele"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TacheModele" ADD CONSTRAINT "TacheModele_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SousTacheModele" ADD CONSTRAINT "SousTacheModele_tacheId_fkey" FOREIGN KEY ("tacheId") REFERENCES "TacheModele"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Projet" ADD CONSTRAINT "Projet_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Projet" ADD CONSTRAINT "Projet_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Projet" ADD CONSTRAINT "Projet_modeleId_fkey" FOREIGN KEY ("modeleId") REFERENCES "ProjetModele"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Projet" ADD CONSTRAINT "Projet_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Tache" ADD CONSTRAINT "Tache_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Tache" ADD CONSTRAINT "Tache_modeleId_fkey" FOREIGN KEY ("modeleId") REFERENCES "TacheModele"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Tache" ADD CONSTRAINT "Tache_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SousTache" ADD CONSTRAINT "SousTache_tacheId_fkey" FOREIGN KEY ("tacheId") REFERENCES "Tache"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS comme le reste de la base : aucun accès direct via les clés Supabase, sauf l'équipe ADMIN.
-- (L'app passe par Prisma, qui n'est pas soumis au RLS.)
do $$
declare t text;
begin
  foreach t in array array['Cible','Prospect','ProspectContact','Echange','RendezVous','ProjetModele','TacheModele','SousTacheModele','Projet','Tache','SousTache']
  loop
    execute format('alter table public.%I enable row level security', t);
    if exists (select 1 from pg_proc where proname = 'is_admin') and exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    end if;
  end loop;
end $$;
