# Espace Commercial (CRM)

Accès : carte « Commercial » du tableau de bord admin, ou directement `/crm`. Les comptes **Commercial**
(alternants, commerciaux) arrivent directement ici et ne voient pas le reste de l'admin.

## Mode Prospection
- **Ma journée** (`/crm`) : relances du jour et en retard, RDV de la semaine, bouton « Lancer ma session d'appels »
  qui enchaîne les fiches (noter l'échange ouvre la suivante, « Passer » saute une fiche).
- **Pipeline** (`/crm/pipeline`) : 5 colonnes, glisser-déposer les cartes ; en glissant, zones Gagné / Perdu en bas
  (Perdu demande le motif). Filtres : Tous, Moi, chaque commercial, Sans commercial, recherche, cible.
- **Fiche** : noter un échange (NRP, Appel, Mail, PP = prospection physique, Prise de RDV, RDV) ; le statut et la
  relance proposés se remplissent seuls et restent modifiables. « Je reprends » s'attribue le prospect.
- **Nouveau** : contrôle des doublons (SIREN, téléphone, site, nom) sur les prospects et les clients du portail.
- **No show** : dans « Noter un échange », RDV → « No show ». Le RDV passe en no show (exclu des RDV pris).
  « À recaler plus tard » : le prospect repart en « Poser RDV ». « Reporter le RDV » : nouvelle date, le prospect
  reste en « RDV posé » et le report (rattaché au RDV manqué) ne compte pas comme un nouveau RDV pris.
- **Notes obligatoires** pour Appel, PP, RDV et Prise de RDV.
- **Stats** (`/crm/stats`) : période (7 j, 30 j, 3 mois, 12 mois) et commercial ; appels, RDV pris, no show,
  signatures, CA signé (création + 12 mois), activité par type, RDV, pipeline, entonnoir, classement.
- **Équipe** (admins) : créer le compte d'un alternant / commercial (lien de connexion envoyé à SON adresse), retirer un accès.

## Mise en place (une fois)
```bash
# Mac, dans le dossier du portail
npx prisma migrate deploy && npx prisma generate
npx tsx --env-file=.env scripts/import-crm.mts --crm ~/Downloads/CRM_APP.xlsx --todo ~/Downloads/TODO_ACCO.xlsx             # aperçu
npx tsx --env-file=.env scripts/import-crm.mts --crm ~/Downloads/CRM_APP.xlsx --todo ~/Downloads/TODO_ACCO.xlsx --confirmer
```
L'import n'envoie **aucun** mail, push ni invitation. Il recrée les vrais clients dans le portail (client, site,
abonnement) sans compte de connexion ; leurs contacts sont rangés dans leur fiche CRM. Relançable sans doublon.

## Données de test
```bash
npx tsx --env-file=.env scripts/donnees-test-crm.mts --creer      # ~49 prospects « (test) » (dont des no show), échanges, RDV, 2 projets
npx tsx --env-file=.env scripts/donnees-test-crm.mts --supprimer  # retire tout ce qui est marqué test
```
Uniquement dans les tables du CRM : aucun client, site, abonnement ou compte du portail, aucun mail. Les numéros
utilisent la plage 06 39 98 réservée à la fiction (ARCEP) et les emails @example.com.

## À venir
Mode Production (projets, modèles, to-do, récurrence, brief), calendrier, passage client depuis
« Gagné », contrat Google Docs.
