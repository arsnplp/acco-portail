-- Jour du mois où le client est prélevé (feuille des clients : « Jour_Facturation »).
ALTER TABLE "Contrat" ADD COLUMN "jourPrelevement" INTEGER;
