# Modules et rôles

Quatre modules, chacun ouvert à des rôles précis (vérifié côté serveur à l'entrée de chaque page et action) :
- **Pilotage** (`/admin/pilotage`) : Direction (`ADMIN`) seulement. MRR, abonnements, clients, équipe ; projection et activité par collaborateur à venir.
- **Prospection** (`/crm`) : Direction et Commerciaux (`COMMERCIAL`). Tout le CRM ci-dessous.
- **Suivi** (`/admin/...`) : toute l'équipe (Direction, Commerciaux, Développeurs `DEV`, Experts `EXPERT`, Spécialistes `SPECIALISTE`),
  jamais les clients. Offres, commandes et recommandations restent réservées à la Direction et aux commerciaux.
- **Espace client** (`/`) : clients seulement, hermétique.

Rôles et comptes : Prospection → Plus → Équipe (Direction). Chaque membre a ses paramètres personnels (compte Google, notifications)
depuis son avatar ; les clés API et le Google de l'agence restent au gestionnaire. Accueil selon le rôle : Direction `/admin`,
commercial `/crm`, autres `/admin/suivi`.

## Fiche client (Suivi)
`/admin/clients/<id>` : informations et contacts (ceux de la fiche prospect liée), contrat et offre (formule Essentiel / Référence /
Conquête / Signature, dates d'engagement, « Suivi par », développeur attitré, client référence épinglé en tête de liste), technique
et web (sites, prévisualisation, fiche Google), historique des échanges (appels Aircall, emails, comptes rendus saisis à la main :
appel, réunion, mail, visite, note), demandes de modification des sites, accès du client, journal des connexions (qui se connecte,
quand, depuis quel appareil ; purgé après 6 mois par le cron rgpd). « Dernier contact il y a N j » passe en rouge au-delà de 60 jours.

# Espace Commercial (CRM)

Accès : carte « Commercial » du tableau de bord admin, ou directement `/crm`. Les comptes **Commercial**
(alternants, commerciaux) arrivent directement ici et ne voient pas le reste de l'admin.

## Mode Prospection
- **Ma journée** (`/crm`) : relances du jour et en retard des fiches À relancer, Poser RDV et À signer (pas les leads
  « À contacter », travaillés en session depuis le pipeline), RDV de la semaine, bouton pour activer les notifications.
- **Heure de relance (facultative)** : dans « Noter un échange » ou la fiche. À cette heure, le commercial associé
  reçoit un push sur son téléphone et un bandeau en haut de l'app (même en session). Le serveur vérifie chaque minute
  (`src/instrumentation.ts`) ; secours possible par cron : `/api/cron/rappels` avec `CRON_SECRET`.
- **Attribution** : « Je reprends » pour tous ; « Attribuer à… » (n'importe quel membre) pour les admins seulement.
- **Historique** (admins, `/crm/historique`) : tous les échanges de l'équipe par jour, filtrables par personne, type, période.
- **Sessions d'appels** : bouton « Lancer la session » en haut de chaque colonne du pipeline (avec les filtres en
  cours). Noter l'échange ouvre la fiche suivante de la colonne, « Passer » saute une fiche, « Arrêter » revient au pipeline.
- **À contacter** = jamais eu au téléphone (aucun échange ou que des NRP). Un NRP laisse la fiche où elle est ;
  un appel, mail ou PP la fait passer en « À relancer ». Pour remettre les fiches existantes d'aplomb :
  `npx tsx --env-file=.env scripts/recaler-a-contacter.mts` (aperçu) puis `--confirmer`.
- **Jauge NRP** sur chaque carte et fiche : 0 à 5+ appels sans réponse (jaune, orange, rouge).
- **Pipeline** (`/crm/pipeline`) : 5 colonnes, glisser-déposer les cartes ; en glissant, zones Gagné / Perdu / Abandon en bas
  (Perdu et Abandon demandent le motif). Filtres : Tous, Moi, chaque commercial, Sans commercial, recherche, cible.
- **Abandon** : statut distinct de Perdu pour écarter proprement une fiche (hors cible, doublon, numéro invalide…) sans la
  supprimer. Elle sort du pipeline, de la journée et du calendrier ; on la retrouve et on la repêche dans « Tous les prospects ».
  La **suppression d'une fiche est réservée aux admins** (les commerciaux passent la fiche en Abandon). Un échange ne se supprime
  que par un admin ou par son auteur (jamais un appel Aircall ou un mail synchronisé).
- **RDV posé = plus de relance** : dès qu'un RDV est pris (prise de RDV, report après no show, passage manuel ou en masse en
  « RDV posé »), la date et l'heure de relance sont effacées : le rendez-vous suffit.
- **Tous les prospects** (`/crm/prospects`, menu Plus) : toutes les fiches, ouvertes ou closes, avec filtres avancés
  (statut dont Abandon, commercial, cible, séquence d'appels jamais / incomplète / faite = 5 appels, motif, période, avec
  enregistrement Aircall, avec notes) et raccourcis (Abandons à repêcher, Séquence incomplète, Pas intéressés, Avec enregistrement).
  Chaque ligne se déplie : dernières notes, résumés et enregistrements Aircall à réécouter sans ouvrir la fiche (débrief des alternants).
  **Actions en masse** : cocher des fiches → changer le statut (avec motif), la date/heure de relance, ou réattribuer (admins).
- **Fiche** : noter un échange (NRP, Appel, Mail, PP = prospection physique, Prise de RDV, RDV) ; le statut et la
  relance proposés se remplissent seuls et restent modifiables. « Je reprends » s'attribue le prospect. Le site web est juste sous le nom de la société.
- **Aircall sur la fiche** : les appels passés et reçus avec les numéros de la fiche arrivent dans l'historique avec le lecteur
  de l'enregistrement, le résumé IA, les sujets, le sentiment et la transcription (licence AI Assist côté Aircall). Synchro
  générale toutes les 5 min (serveur) ou `/api/cron/aircall` avec `CRON_SECRET` ; synchro de la fiche à l'ouverture (10 min
  au plus) et bouton « Actualiser ». Un appel déjà noté à la main dans les 20 min autour est enrichi, pas dupliqué ; un appel
  sortant sans réponse devient un NRP, un appel répondu un Appel, un appel entrant manqué une simple note. Clés : Admin →
  Paramètres → Aircall (ou `AIRCALL_API_ID` / `AIRCALL_API_TOKEN` dans le .env).
- **Emails sur la fiche** : les mails envoyés et reçus avec les adresses des contacts apparaissent dans l'historique (objet,
  extrait, lien Gmail), lus en lecture seule dans toutes les boîtes Gmail connectées : celle de l'agence (gestionnaire,
  Admin → Paramètres) et celle de **chaque membre de l'équipe** qui connecte son propre compte Google (avatar → Paramètres →
  « Mon compte Google » ; les commerciaux ont leur page `/crm/parametres`). Un mail envoyé depuis la boîte d'un membre lui est attribué.
- **Générer les infos** (bouton « Infos du lead » d'une fiche créée à la main) : remplit les 34 colonnes d'un lead du coffre
  (registre officiel, audit du site, recherche web si clé Anthropic) et complète les champs vides de la fiche (SIREN, SIRET,
  dirigeant, site, adresse, email du contact) sans écraser ce qui est saisi.
- **Nouveau** : contrôle des doublons (SIREN, téléphone, site, nom) sur les prospects et les clients du portail.
- **No show** : dans « Noter un échange », RDV → « No show ». Le RDV passe en no show (exclu des RDV pris).
  « À recaler plus tard » : le prospect repart en « Poser RDV ». « Reporter le RDV » : nouvelle date, le prospect
  reste en « RDV posé » et le report (rattaché au RDV manqué) ne compte pas comme un nouveau RDV pris.
- **Notes obligatoires** pour Appel, PP, RDV et Prise de RDV.
- **Stats** (`/crm/stats`) : période (7 j, 30 j, 3 mois, 12 mois) et commercial ; appels, RDV pris, no show,
  signatures, CA signé (création + 12 mois), activité par type, RDV, pipeline, entonnoir, classement.
- **Équipe** (Direction) : créer le compte d'un membre avec son rôle (Direction, Commercial, Développeur, Expert, Spécialiste), changer un rôle, retirer un accès.

## Coffre à leads (`/crm/leads`)
- **Générer** : nombre (1 à 50), secteur et région en texte libre, filtres « mobiles uniquement (06/07) » et
  « avec / sans site », attribution (commercial ou personne). Claude cherche
  sur le web (outil de recherche web de l'API Anthropic), le registre officiel (recherche-entreprises.api.gouv.fr,
  gratuit) complète SIREN, SIRET, dirigeant, forme, NAF, création, état, établissements ; un audit du site remplit
  CMS, hébergeur, HTTPS, mobile, âge du domaine, score et faiblesses SEO. 34 colonnes, comme le fichier Excel de référence.
  Vitesse mobile/desktop : seulement si `PAGESPEED_API_KEY` est dans le .env du serveur.
- **Doublons** : tout ce qui est déjà dans le CRM, le portail ou le coffre est écarté (téléphone, SIREN, site, nom).
  Message « il ne reste que X leads pour cette région » si la zone s'épuise, sinon une estimation de ce qui reste.
- **Utiliser** : « Envoyer dans À contacter » crée les fiches (dirigeant en contact principal, note de synthèse),
  attribuées au commercial de la liste, et la liste passe en « Utilisée ». Export CSV pour Excel.
- **Infos du lead** : bouton sur chaque fiche, fenêtre avec les 34 colonnes du lead (ou message clair si la fiche a été créée à la main).
- Un lead sans numéro de téléphone n'entre jamais dans une liste.
- **Résultats par liste** : envoyés, appelés, joints, RDV pris, signés (avec taux de passage), CA signé et répartition
  des fiches par statut ; résumé sur chaque carte du coffre. Suppression d'une liste (admin ou auteur) : les fiches
  déjà envoyées restent dans le CRM.
- Clé : celle d'Admin → Paramètres (Anthropic, sinon celle de Claude Code). Modèle : `LEADS_MODEL` (défaut claude-sonnet-5-5).
  Coût indicatif affiché sur chaque liste. La génération tourne en arrière-plan (2 à 5 min), 3 listes en même temps au plus.

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
