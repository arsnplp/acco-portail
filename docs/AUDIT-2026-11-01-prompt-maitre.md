# Audit de l'application existante contre le prompt maître ACCO LAB

Date : 1er novembre 2026. Rédigé par Claude pour Arsène (responsable technique). Lecture seule : aucun fichier de code n'a été modifié pour cet audit.

Documents lus : la « version finale » collée dans la conversation (section 00 « amendements d'Arsène », puis sections 1 à 8.1, tronquée), et le fichier `ACCO_LAB_PROMPT_MAITRE_RECONSTRUCTION_MAXIMALE.md` (sections 0 à 25, annexe A). Règle appliquée : **la section 00 prime** ; là où le fichier complet contredit la section 00 (SMS, Canva, actualité externe, transcriptions Aircall, prestataire d'emailing, factures dans le portail, IA automatique), c'est la section 00 qui compte.

Méthode : 11 agents de lecture (un par domaine) ont produit 308 constats sourcés (fichier:ligne) sur les sections 00 et 1 à 8 ; les sections 9 à 25 ont été auditées par Claude directement. Limite : la passe de vérification contradictoire (un sceptique par constat) et le balayage des annexes B et C ont été interrompus par la limite d'utilisation du compte ; ils seront relancés. Les constats ci-dessous ont été relus par Claude, qui a écrit l'essentiel de ce code ; les points marqués « à revérifier » restent à confirmer.

Légende : **A** existant et conforme · **B** existant mais incomplet ou à corriger · **C** à développer · **D** arbitrage indispensable (Arsène ou Direction) · **X** supprimé par la section 00.

---

## 1. Contexte technique (bloc à valider par Arsène)

| Rubrique | Valeur constatée |
|---|---|
| Dépôt | `github.com/arsnplp/acco-portail` (branche `main`) ; copie figée `acco-portail-copy` |
| Stack | Next.js 16.4 (App Router, Turbopack, `src/proxy.ts`), React 19.3, TypeScript strict, Tailwind 4, Prisma 6.19 sur PostgreSQL Supabase (Francfort), Supabase Auth, Resend (emails), web-push, google-auth-library, Anthropic SDK, dnd-kit, zod, exceljs |
| Base | 48 modèles, 33 enums, 24 migrations ; RLS activé mais l'app passe par Prisma avec le rôle service (RLS non protecteur) |
| Hébergement | VPS Hostinger Ubuntu, Node 22, `next start` sous PM2 (**un seul processus, mode fork**), nginx + certbot ; déploiement manuel (`git pull`, `prisma migrate deploy`, `npm run build`, `pm2 restart`) |
| Environnements | **Un seul** : production. Le poste de développement pointe sur la même base Supabase (migrations appliquées directement sur la base de prod). Pas de staging, pas de restauration testée documentée |
| Tâches de fond | 4 boucles mémoire dans `src/instrumentation.ts` (rappels CRM 60 s, récaps horaire, Aircall 5 min, alertes 60 jours horaire) + 6 routes `/api/cron/*` (monitor, reviews, recaps, rgpd, rappels, aircall) avec `CRON_SECRET` |
| Accès de Claude | Dépôt en lecture/écriture ; base via le `.env` local ; aucun accès au VPS ; clés API stockées en base (table `Setting`) ou `.env`, jamais dans le code |
| Tests | **Aucun test automatisé** (ni unitaire, ni intégration, ni e2e). Lint ESLint 9 et `tsc --noEmit` passent |
| Utilisateurs en base | 3 comptes `ADMIN` (Arsène, Bilel, Lucas), 0 commercial, 0 client actif (voir §8) |
| Taille | 241 fichiers TypeScript, 14 300 lignes dans `src/` |

---

## 2. Zone protégée (test DEV-01) — automatisations d'Arsène, à ne pas toucher

Classée protégée, inventoriée sans modification :

| Élément | Rôle |
|---|---|
| `scripts/claude-worker.mts` | Worker Claude Code sur le Mac : clone le dépôt du site, crée une branche `claude/modif-<id>`, applique la demande, prévisualise, fusionne et pousse à la validation |
| `scripts/mac-worker.sh` | LaunchAgent macOS ; fait un `git pull --ff-only` du portail à chaque redémarrage (tout changement sur `main` arrive sur le Mac) |
| `scripts/nouvelle-demande.mts`, `scripts/vider-clients.mts` (destructif), `scripts/import-crm.mts`, `scripts/recaler-a-contacter.mts`, `scripts/nettoyer-donnees-test.mts`, `scripts/donnees-test-crm.mts`, `scripts/lien-connexion.mjs`, `scripts/compte-client-test.mts` | Outils d'exploitation |
| `ops/install-deploy-sites.sh`, `ops/README.md` | Script VPS `deploy-sites` : toutes les minutes, fast-forward des dépôts GitHub des sites clients vers leur dossier servi (13 sites) |
| `snippets/formulaire-acco.html`, `snippets/AccoForm.tsx`, `src/app/api/forms/*` | Formulaire de contact intégré aux sites clients (Turnstile, clé de site) |
| `src/lib/change-requests.ts`, `src/app/api/claude/*`, `src/app/admin/modifications/*` | Code partagé app ↔ worker, callbacks du worker, kanban des modifications qui pilote le worker (« Confier à Claude », « Mettre en ligne » = merge + push) |
| `prisma/schema.prisma` : `Site.repoUrl/repoBranch/repoRoot`, `ChangeRequest.claude*`, enum `ClaudeJobState` | Champs du worker |
| `src/lib/monitor.ts`, `/api/cron/monitor` | Surveillance HTTP/TLS des sites (lecture seule) |
| `CLAUDE-WORKER.md`, `DEPLOIEMENT.md` | Procédures |

Point à arbitrer (D) : l'onglet **Suivi → Modifications** commande la chaîne GitHub (merge + push). Selon 00.2, la couche Production ne doit pas piloter les automatisations. Soit cet onglet est classé « outil d'Arsène » et reste tel quel, soit il est séparé de la couche de suivi. Constat associé : les champs dépôt GitHub / branche / dossier de la fiche site sont modifiables par **tout** membre de l'équipe (`requireTeam`), prestataires compris.

---

## 3. Matrice par domaine

### 3.1 Rôles, modes, navigation (sections 2.1, 2.2, 20.1)

| État | Constat |
|---|---|
| A | Espaces Accueil, Prospection, Suivi, Pilotage, Portail client existent ; chaque page et action serveur vérifie le rôle (`requireTeam`, `requireProspection`, `requireAdmin`, `requireClientContext`) |
| B | Un seul rôle `ADMIN` cumule Direction et administration technique ; **Lucas « Direction sans admin » est inexprimable** : pour lui ouvrir Pilotage il faut le passer ADMIN, ce qui lui donne aussi la gestion des comptes et rôles |
| B | La partie technique (clés, Google agence, interrupteurs) dépend d'une liste d'emails `GESTIONNAIRE_EMAILS` (défaut codé `arsene@acco-lab.fr`, non documenté dans `.env.example`) : Bilel ne voit pas la page des interrupteurs, contrairement à 00.6 |
| B | Aucune notion de « mode » (vue de travail) : la nav dépend du rôle. Le sélecteur Prospection / Production du CRM pointe vers une page vide |
| C | Chefs de service, pouvoirs délégués, périmètres, permissions fines (lire / créer / modifier / attribuer / valider / exporter / archiver) : rien ; les contrôles sont des `me.role === "ADMIN"` dispersés |
| C | Espace RH, espace Administration unifié « IA et intégrations » : absents (RH prévu après la V1) |
| **CONFLIT** | **Rôle `EXPERT` (prestataire) = membre de l'équipe avec tout le Suivi** : liste complète des clients, fiches, montants, Aircall, et pouvoir de mettre un site en ligne. La section 13 exige un périmètre limité aux projets attribués et aucun accès Gmail/Aircall |

### 3.2 Tableaux de bord (sections 2.3, 2.4, 00.8)

| État | Constat |
|---|---|
| B | `/admin/suivi` : compteurs (modifs ouvertes, messages non lus, commandes, recommandations, documents attendus) + engagements à 60 jours. Global, identique pour tous les rôles, sans périmètre par commercial |
| B | Bloc 1 (sites en cours) vit dans Production, pas sur le tableau commercial ; sans bloquants ni prochaine action |
| C | Bloc 2 (RDV à planifier déclenchés par une maquette prête) : aucun déclencheur |
| **CONFLIT** | Bloc 3 : l'alerte « 60 jours sans contact » (`src/lib/alertes.ts`) **n'exclut pas un client ayant un RDV à venir** (test SUI-03 échoue) |
| C | Bloc 7 (tâches commerciales liées aux clients) : le modèle `Tache` existe (import de l'ancienne to-do) mais n'est relié qu'aux projets, jamais aux clients |
| C | Vues enregistrables, widgets réordonnables, tableau Production d'Arsène (briefs à approuver, charge par développeur, bloqués), tableau par service, liste « en attente de ma validation » et délégation temporaire : absents |
| A | Aucun chiffre fictif codé en dur dans les tableaux ; les chiffres « 700 000 € / 45 clients » n'apparaissent nulle part |

### 3.3 Tableau clients (sections 3.2, 3.3, 00.1)

| État | Constat |
|---|---|
| A | Séparation Prospect / Client sans duplication (`Prospect.clientId`) ; recherche tolérante ; vue Mes clients / Tous ; références épinglées ; dernier contact affiché |
| B | 2 filtres sur les 23 demandés ; pas de tri, de colonnes, de vues enregistrées, d'actions groupées, d'export, d'archivage (le CRM « Tous les prospects » a déjà sélection + actions en masse, réutilisable) |
| B | Réattribution du référent : tout commercial peut la faire, sans trace ; aucune délégation temporaire ; les RDV et l'agenda Google ne suivent pas |
| C | Logo client (00.1) : aucun champ, aucune vignette, aucune pastille d'initiales colorée, pas de dépôt par le client |
| **CONFLIT** | `logoUrl()` du CRM utilise le service **Google Favicons** (service externe de logos interdit par 00.1) sur les cartes du pipeline et la fiche prospect |

### 3.4 Fiche client (sections 4, 00.6 « En bref », 00.10)

| État | Constat |
|---|---|
| **CONFLIT** | 4.1 : la fiche est **une seule longue page** à 9 sections, pas « page principale + onglets » |
| B | Contacts : lus depuis la fiche prospect liée (`ProspectContact`) ; un client sans fiche prospect n'a aucun contact ; pas de contact rattaché au `Client` |
| B / **CONFLIT** | **Aucun modèle Contrat** : `Subscription` tient lieu de ligne de service (prix, mensuel/ponctuel, site, fin d'engagement) ; mais `Client.formule / engagementDebut / engagementFin` sont **uniques par client**, ce qui contredit « plusieurs contrats par client » (section 4.2, A.1). Deux sources de montants : `Subscription.priceCents` et `Prospect.mensuelEuros` (stats CRM) |
| B | Options par site : `Subscription.siteId` existe, mais « À proposer » est calculé au niveau client (une option active sur Site 1 n'est plus proposée pour Site 2 → test SUI-02 échoue) |
| B | Timeline : appels Aircall, mails Gmail, comptes rendus ; pas de filtres, pas de vues Emails / Appels séparées ; livraisons, parrainages, incidents n'y figurent pas |
| B | Notes internes : ce sont des échanges de type NOTE mêlés à la timeline ; invisibles du portail (conforme), mais visibles de toute l'équipe, prestataires compris |
| C | Bloc « En bref » calculé, alertes regroupées, RDV et tâches sur la fiche, satisfaction et parrainage sur la fiche |
| C | Champs financiers V1 (00.10) : montant **HT** non qualifié, **moyen de paiement**, **premier paiement reçu**, **impayé / régularisé**, historique des modifications, identifiant externe / source / date : absents |
| **CONFLIT** | « Activer pour ce client » crée un abonnement actif immédiatement, sans devis, contrat ni avenant (4.4 : jamais de facturation silencieuse) |
| **CONFLIT** | La fiche et la fiche prospect lancent la synchro Aircall + Gmail **au chargement** (garde-fou 10 min), contraire à 00.8 |

### 3.5 Contrats, conversion, catalogue (sections 5, 6, 00.5, 00.10)

| État | Constat |
|---|---|
| C | **Générateur de contrats : inexistant** (ni PDF, ni bibliothèque PDF dans les dépendances, ni statuts, ni acceptation en ligne, ni empreinte SHA-256, ni certificat, ni avenants versionnés, ni relances) |
| C | **Conversion prospect gagné → client : inexistante** ; `GAGNE` ne pose qu'un statut. Les clients se créent à la main (« Nouveau client ») sans lien prospect ni commercial. Seul le script d'import a une logique idempotente |
| B | Doublons : contrôlés à la création d'un prospect (SIREN, téléphone, site, nom) et contre les clients ; rien à la création d'un client |
| B | Catalogue `Offer` (prix, promo, module, offres complémentaires, archivage) existe ; pas de familles de workflow, pas de non-rétroactivité (le prix est copié dans l'abonnement, ce qui protège déjà le contrat signé) |
| B | Engagement : date libre ; commande validée avec 12 mois par défaut (pas 24) ; alerte à 60 jours sur le tableau Suivi, pas J−90 au référent |
| **CONFLIT** | `deleteDocument` supprime n'importe quel document, contrat compris (00.5.6 : immuable) |
| C | Premier paiement, dérogation à deux niveaux (Bilel ou Lucas puis Arsène), brief dès signature, production conditionnée : absents ; un site entre en production dès sa création |

### 3.6 Communications (sections 7, 8, 00.3, 00.4, 00.7)

| État | Constat |
|---|---|
| A | Gmail lecture : entrants et sortants, toutes les boîtes connectées (agence + personnelles), direction déduite, extrait, fil ; repli manuel (compte rendu) si coupé |
| B | Gmail : 5 adresses max par fiche, uniquement les contacts de la fiche **prospect** (pas `Client.email`) ; 50 derniers messages sans curseur ; dédoublonnage **par boîte** (un mail en copie dans deux boîtes = deux lignes) ; pas de pièces jointes, pas de rattachement manuel, pas de journal d'erreurs persistant |
| **CONFLIT** | **Tout envoi d'email passe par Resend** (prestataire tiers) : invitations, notifications clients, récaps, alertes. 00.4 impose l'API Gmail pour les messages aux clients. Aucun envoi Gmail (scope `gmail.readonly` seulement), aucun envoi groupé, modèle, aperçu, plafond, file, désinscription |
| **CONFLIT** | **Aircall** : enregistrements (lecteur audio), transcriptions, résumés IA, sujets, sentiment sont récupérés, stockés dans `Echange.meta`, affichés, et repassés jusqu'à 48 h. 00.3 et 00.7 les suppriment (métadonnées seulement) |
| A | Aircall métadonnées, synchro planifiée toutes les 5 min, interrupteur `feature_aircall` |
| C | Interrupteurs par connecteur (Gmail, Calendar) avec état, dernière synchro, journal d'erreurs : absents (connecteur actif dès qu'un jeton existe) |
| B | Google Agenda : **app → Google seulement** (RDV prospects et échéances de sites). Pas de lecture Google → app : un RDV déplacé ou annulé dans Google n'est pas vu, un événement supprimé dans Google est recréé. Pas d'invités, pas de Meet |
| A | SMS : aucune trace (conforme 00.3) |
| RISQUE | Récap mensuel envoyé **automatiquement** aux clients (Resend + push) avec un texte rédigé par Claude, sans validation humaine, pouvant déclencher une demande d'avis |

### 3.7 IA et intégrations (sections 9, 17, 00.6, 00.8)

| État | Constat |
|---|---|
| **CONFLIT** | `featureEnabled` considère **activé** tout interrupteur absent de la base (défaut `true`) ; 00.6 veut tout désactivé par défaut |
| **CONFLIT** | IA en tâche planifiée : résumé du récap mensuel (`summarizeMonth`) par ticker et cron ; réponse suggérée pour chaque nouvel avis (`suggestReviewReply`) par cron |
| **CONFLIT** | IA au chargement d'une page : onglet Conseils du portail (`conseilsPourSite` → Claude quand le cache de 7 jours est périmé) |
| **CONFLIT** | « Générer les infos » (fiche prospect) = recherche web Claude sur l'entreprise (fiche Google, avis, réseaux) : relève de « l'actualité externe » supprimée par 00.3 **ou** de Prospection protégée (D) |
| B | Génération de leads (Prospection) : sur clic, coût estimé par liste, mais **aucun plafond mensuel ni compteur global** ; la clé Claude Code sert de repli à la clé Anthropic sans tenir compte des interrupteurs |
| C | Page « Administration > IA et intégrations » (Bilel et Arsène), plafond mensuel, compteur par fonctionnalité, modèle le moins coûteux (tout est en `claude-sonnet-5-5`) : absents |
| C | Les 8 fonctions IA du tableau 00.6 (synthèse sur clic, Intelligence client, score par règles, suggestions, brouillons, résumé de CR, assistant Pilotage, rapports) : aucune n'existe, ni leur version sans IA (« En bref », score par règles) |
| A | Replis sans IA présents partout où l'IA est utilisée (gabarits, règles) ; vérification de clé sans coût |
| A / RISQUE | Claude Code (modifications de sites) : la mise en ligne exige un clic humain (« Mettre en ligne »), conforme 17 ; mais « Confier à Claude » est ouvert à tout membre de l'équipe |

### 3.8 Production (sections 10, 11, 12, 13, 00.2)

| État | Constat |
|---|---|
| A | Kanban des sites en création, échéances V1/V2/livraison sur les cartes, développeur attitré, filtre, zone « Livré », flux d'activité, suivi des articles de blog par site ; la Production ne pilote aucune automatisation (lecture/écriture de statut seulement) |
| **D** | **Libellés des colonnes** : 10.2 fixe six libellés exacts (Créer maquette, Valider maquette, Modifier, Valider modification, Finir, À livrer) ; Arsène a demandé hier cinq colonnes (Maquette, Attente de validation, Modification, Attente de validation et finition, À livrer) + zone Livré. La décision la plus récente prévaut, mais à confirmer par écrit |
| C | Brief collaboratif (reçu / attendu / incomplet / validé), double validation commercial + Arsène, dérogation « carte blanche » tracée : absents (seuls des « éléments demandés au client » existent) |
| **CONFLIT** | **Maquette visible par le client dès que `previewUrl` est renseigné** (carte « Voir l'avancée du site ») : aucun verrou « Envoyer maquette », aucune validation Bilel + Arsène (tests PRO-04 à PRO-06 échouent) |
| B | Modifications avant livraison : seule la validation client V1/V2 existe ; pas de liste consolidée par version. Après livraison : tickets `ChangeRequest` avec quota mensuel ; pas de quota « 2 / 5 allers-retours sur 24 mois » |
| **CONFLIT** | Dates de production et mise en ligne modifiables par **tout** membre de l'équipe (10.6 : Arsène seul), sans trace ancienne/nouvelle date ni motif |
| C | Document de réception signé, tâches récurrentes par service souscrit (les modèles `Projet/Tache/Recurrence` importés existent mais ne sont utilisés nulle part), versions V1/V2/V3, charge par développeur, coûts prestataires, familles de services avec workflow, responsable de service : absents |
| B | Demandes (12) : `ChangeRequest` avec 4 statuts, 2 niveaux d'urgence, assignation libre ; pas de typologie, de SLA, d'accusé de réception avec référence, d'escalade, d'états « pris en charge / résolu / clôturé » |
| C | Portail prestataire (13) : inexistant (voir 3.1) |

### 3.9 Portail client (sections 14, 15, 00.1, 00.10)

| État | Constat |
|---|---|
| A | Portail cloisonné (`requireClientSite` → 404 hors périmètre, test POR-02 passe), activité du site (journal des interventions réelles, POR-03 passe), résultats Search Console **en cache** (`SearchStatsMonthly`), documents et demandes de documents, demandes de modification avec quota, messages, notifications, parrainage, dépôt des éléments demandés |
| **CONFLIT** | Onglets grisés « Disponible à la mise en ligne », onglet Avis verrouillé avec maquette floutée et argumentaire, onglet Offres permanent avec prix : contraire à « jamais de menus verrouillés non souscrits » (2.4, 14.1 ; test POR-01) |
| **CONFLIT** | Factures : type de document `FACTURE`, textes « Contrats, factures, devis » dans le portail ; 00.10 / PAY-04 : aucune facture dans l'app. Prix des abonnements et fin d'engagement affichés sur Mon compte (D : donnée contractuelle tolérée ?) |
| **CONFLIT** | Données de démonstration intégrées au code de production : chiffres Search Console inventés quand Google n'est pas configuré, 8 avis fictifs quand le module Avis n'est pas actif |
| **CONFLIT** | Avis Google synchronisés au chargement de la page Avis (API Business Profile) si plus de 6 h ; Search Console rafraîchie une fois par mois, pas chaque jour |
| B | Conseils (14.4) : règles présentes (fiche Google, avis, article, réseaux, Pages Jaunes, contact) mais ne tiennent pas compte de ce qu'ACCO fait déjà pour le client (GBP géré par ACCO) ; reformulation IA au chargement |
| C | Maquette verrouillée, commande d'article depuis le portail, dépôt de logo, enquêtes de satisfaction, récompense de parrainage conditionnée au premier paiement + 14 jours |

### 3.10 Pilotage, finance, RH (sections 16, 18, 19, 00.10)

| État | Constat |
|---|---|
| A | MRR = abonnements mensuels actifs ; projection 6 mois ; activité 30 jours par collaborateur ; historique global |
| C | Charges (mensuelles, fixes, ponctuelles), résultat mensuel, courbe 12 mois, nouveau MRR / MRR perdu, rentabilité par client, impayés, source financière interchangeable : absents. Une seule page, pas 8 onglets. 00.8 place Pilotage après la V1 |
| X | Qonto / Pennylane / Stripe, virements, relances J+1…J+30, factures : hors V1 (00.10) ; aucune trace dans le code (conforme) |
| C | RH : absent (après V1) |

### 3.11 Sécurité, archivage, migration, modèle (sections 20 à 22)

| État | Constat |
|---|---|
| A | Permissions côté serveur, cookies de session Supabase, stockage privé par bucket avec URL signées, purge RGPD quotidienne, journal des connexions (6 mois) |
| B | Journal d'audit : `Activite` couvre étapes, livraisons, modifications, articles, comptes rendus ; pas les réattributions, changements de dates, de prix, de droits ; pas « append-only » garanti |
| C | 2FA, archivage par défaut (aucun champ d'archivage sur `Client`, `Site`), hard delete réservé (scripts destructifs présents), environnement de test, sauvegardes testées, pagination (listes chargées entièrement puis filtrées en mémoire, N+1 sur l'accueil Suivi) |
| **C** | **Migration (21) : à faire entièrement.** La base contient 1 client (test), 0 abonnement, 1 site. Le script `scripts/import-crm.mts` (ancien CRM Excel → prospects, clients, sites, abonnements, idempotent) existe mais n'a pas été exécuté sur cette base, ou la base a été vidée depuis |
| B | Modèle (22) : `Client 1:N Site` et `Subscription.siteId` existent ; manquent `Contrat`, `LigneDeService`, `Avenant`, `Contact` rattaché au client, événements métier |

---

## 4. Conflits entre la section 00 et le code actuel (liste d'actions, à arbitrer avant tout code)

1. **Aircall** : retirer enregistrements, transcriptions, résumés IA, sentiment, sujets (`src/lib/aircall.ts`, composant `echange-detail.tsx`, route d'écoute). Question : purger aussi les analyses déjà stockées dans `Echange.meta` ?
2. **Resend** : conserver pour le transactionnel (liens de connexion, invitations, alertes internes) ou tout basculer sur l'API Gmail ? Les messages adressés aux clients (notifications, récaps) doivent-ils passer par Gmail ?
3. **IA par défaut** : passer tous les interrupteurs à « désactivé » par défaut ; supprimer l'IA du récap automatique et de la réponse aux avis en cron ; rendre les conseils du portail « sur clic » ou règles seules ; ajouter plafond et compteur.
4. **« Générer les infos »** (recherche web sur une entreprise) : à supprimer (00.3) ou à conserver comme fonction de Prospection avec son propre interrupteur ?
5. **Logos** : retirer le service Google Favicons du CRM, ou le tolérer en Prospection et n'appliquer 00.1 qu'au Suivi ?
6. **Factures et prix dans le portail** : retirer le type `FACTURE` et les textes ; décider si le prix d'abonnement sur « Mon compte » est une donnée contractuelle autorisée.
7. **Menus verrouillés du portail** (onglets grisés, Avis flouté, onglet Offres) : masquer ce qui n'est pas souscrit ; décider de la place des offres (espace dédié non intrusif).
8. **Données de démonstration** (Search Console, avis) : à retirer du code de production ou à confiner derrière un mode explicitement « démo ».
9. **Synchro au chargement** (Aircall, Gmail, avis) : basculer en tâches planifiées, les pages ne lisant que la base.
10. **Prestataires** : sortir `EXPERT` et `SPECIALISTE` du module Suivi complet tant que le portail prestataire n'existe pas (aujourd'hui ils voient tout et peuvent mettre en ligne).
11. **Mise en ligne et dates** : réserver `livrerSite`, le statut « En ligne », les deadlines et les champs GitHub à Arsène (ou Direction).
12. **Maquette** : ne plus afficher `previewUrl` au client tant qu'un clic « Envoyer maquette » n'a pas eu lieu.
13. **Alerte 60 jours** : exclure les clients avec un RDV à venir.
14. **Kanban Production** : libellés 10.2 ou libellés demandés le 31 octobre.

---

## 5. Risques

- **Un seul environnement et une seule base** : chaque migration et chaque déploiement touchent la production ; le poste de développement écrit dans la base de prod. Avant les chantiers Contrats et Migration, un projet Supabase de test et une restauration de sauvegarde testée sont indispensables.
- **Aucun test automatisé** sur 14 300 lignes ; les chantiers permissions, contrats et conversion sont exactement ceux où une régression coûte cher.
- **Permissions trop larges** : `requireTeam` suffit pour mettre un site en ligne, résilier un abonnement, changer un dépôt GitHub, confier une modification à Claude, lire tous les montants.
- **Tâches de fond en mémoire** sur un seul processus PM2 : pas de reprise après plantage, pas de verrou multi-processus ; un passage en cluster dupliquerait les boucles.
- **Secrets en clair** dans la table `Setting` (lisibles par toute requête service) ; clé Claude Code utilisée en repli pour les leads.
- **Scripts destructifs** (`vider-clients.mts`) sans garde d'environnement ; `donnees-test-crm.mts` peut créer des montants fictifs en prod.
- **Récap mensuel et demande d'avis automatiques** sans validation humaine.
- **Le worker Mac fait `git pull` du portail** : une modification de `src/lib/change-requests.ts` ou du schéma se propage au worker au prochain redémarrage (zone protégée à inclure dans toute revue).
- **Migration non faite** : aucune donnée client réelle en base ; toute démonstration à l'équipe sera sur des données vides.

---

## 6. Lots de réalisation proposés (V1 = Suivi, Production, Portail client, Contrats communs)

Chaque lot se teste indépendamment et correspond à des scénarios de recette. Ordre proposé ; rien ne démarre sans accord d'Arsène.

| Lot | Contenu | Dépend de | Recette |
|---|---|---|---|
| **0. Socle** | Projet Supabase de test + restauration testée ; branche par lot ; premiers tests automatisés (permissions, conversion) ; `GESTIONNAIRE_EMAILS` et variables manquantes documentées ; suppression des données de démo et des scripts destructifs hors local | — | OPT-01 (partiel), DEV-01 |
| **1. Conformité section 00** | Les 14 points du §4 : Aircall métadonnées seulement, interrupteurs désactivés par défaut, page Administration > IA et intégrations (Bilel + Arsène) avec plafond, compteur, état des connecteurs ; synchros en tâches planifiées ; portail sans menus verrouillés ni factures ; alerte 60 jours avec RDV ; prestataires hors Suivi complet | 0 | OPT-01 à OPT-04, PAY-04, SUI-03 |
| **2. Droits et modes** | Permissions par action et périmètre (Direction sans admin pour Lucas, chefs de service, référent / délégataire), délégation temporaire datée, journal d'audit des réattributions, dates et prix ; liste « en attente de ma validation » ; modes de démarrage (Commercial, Production) | 0 | SUI-05, SUI-06, SUP-01, PRO-08 |
| **3. Modèle Contrat et fiche client** | Entités Contrat (statut, formule, montant HT, moyen de paiement, début/fin, renouvellement, préavis, premier paiement, impayé, source financière), lignes de service par site, avenants versionnés, contacts rattachés au client ; **fiche client en page principale + onglets** ; « À proposer » par site ; logo client (upload, miniature, initiales) ; « En bref » calculé | 2 | SUI-01, SUI-02, CON-02, CON-03, CON-05, LOGO-01, PAY-01, PAY-02 |
| **4. Générateur de contrats commun** | Modèles de contrat, PDF serveur (bibliothèque gratuite, ex. pdf-lib), envoi par Gmail avec lien sécurisé, acceptation en ligne (nom, case, code email, IP, navigateur, SHA-256, certificat PDF), dépôt du scan, statuts, archivage immuable, relances validées ; conversion prospect → client idempotente ; même générateur depuis Prospection et Suivi | 3 + Gmail envoi (lot 6) | CON-01, CON-04, CON-06, SIG-01, MIG-01 |
| **5. Production, couche de suivi** | Brief collaboratif avec états et double validation, dérogation de paiement à deux niveaux, validation de maquette Bilel + Arsène, verrou « Envoyer maquette », liste de modifications par version, dates réservées à Arsène avec trace, checklist et go-live, réception signée, tâches récurrentes par service souscrit, charge par développeur, tableau de bord Production | 3 | PRO-01 à PRO-10 |
| **6. Communications** | Envoi Gmail (scope `gmail.send`), modèles avec variables, aperçu, envoi test, envoi groupé plafonné et étalé avec validation humaine, désinscription ; Gmail lecture améliorée (curseur, dédoublonnage multi-boîtes, rattachement manuel, journal) ; Calendar bidirectionnel (lecture, invités, Meet) ; tâches commerciales liées aux clients ; tableau d'accueil commercial 2.3 ; tableau clients complet (filtres, vues, actions groupées) | 2 | SUI-04, SUI-07, SUI-08, SUI-10, MAIL-01 |
| **7. Portail client** | Activation à la signature, brief côté client, maquette après « Envoyer maquette », commande d'article pour les offres concernées, conseils excluant ce qu'ACCO fait, dépôt de logo, notifications regroupées, parrainage conditionné | 4, 5 | POR-01 à POR-03, PRO-06 |
| **8. Migration** | Reprise des 18 clients, contrats, sites, échéances depuis l'ancien CRM et Pennylane (export), dry-run sur la base de test, journal des correspondances, vérification client par client | 3 | MIG-01, PAY-03 |
| **Après V1** | Charges et résultat mensuel (Pilotage > Charges), Pilotage en onglets, demandes avec SLA et escalade, portail prestataire, parrainage avancé, RH, fonctions IA sur clic | — | PAY-03, PIL-01, SUP-02 à SUP-04 |

Estimation d'effort relative (petit / moyen / gros) : lot 0 moyen ; lot 1 moyen ; lot 2 gros ; lot 3 gros ; lot 4 gros ; lot 5 gros ; lot 6 gros ; lot 7 moyen ; lot 8 moyen.

---

## 7. Questions à Arsène (architecture, production, fonctionnalités manquantes)

1. Les 14 arbitrages du §4 (en particulier Aircall, Resend, « Générer les infos », libellés du kanban).
2. Environnement de test : peut-on créer un second projet Supabase et une branche de déploiement sur le VPS avant les lots 3 et 4 ?
3. Modèle de données : créer une entité `Contrat` regroupant des lignes `Subscription`, et migrer `Client.formule / engagementDebut / engagementFin` vers ce contrat ? Ou étendre `Subscription` ?
4. Déclencheur de conversion : le passage en « Gagné » dans le pipeline, ou uniquement la signature du contrat ?
5. Suivi → Modifications et le worker Claude Code : zone protégée intouchable, ou couche Production à cloisonner (droits) ?
6. Lucas : un rôle `DIRECTION` distinct d'`ADMIN`, ou des droits unitaires (pilotage, équipe, réglages) par utilisateur ?
7. Bilel sur la page « IA et intégrations » : élargir `GESTIONNAIRE_EMAILS` ou créer un droit dédié ?
8. Le logo : champ sur `Client` déposable depuis le portail, ou promotion de l'élément « Votre logo » du site ?
9. Les données de l'ancien CRM : le fichier Excel et un export Pennylane sont-ils disponibles pour la migration (lot 8) ?

---

## 8. État réel des données au 1er novembre 2026

| Table | Contenu |
|---|---|
| Clients | 1 (acco-lab.fr, sans fiche prospect, sans commercial, sans membre) |
| Abonnements | 0 (MRR affiché : 0 €) |
| Sites | 1 en ligne |
| Prospects | 52 (33 à contacter, 5 à relancer, 1 perdu, 13 abandon) ; 52 leads générés |
| Échanges | 128 (45 saisis, 51 notes de leads, 21 Aircall, 11 Gmail) |
| Comptes | 3 Direction, 0 commercial, 0 client |
| Demandes de modification | 1 terminée ; commandes 0 ; parrainages 0 ; connexions journalisées 0 |

---

## 9. Ce qui reste à faire pour clore l'audit

- Relancer la vérification contradictoire des 308 constats (interrompue par la limite d'utilisation).
- Balayer les annexes B (ancien prompt 2.0) et C (référentiel IA V3) pour lister les décisions absentes des sections 1 à 25 ou contredites par la section 00.
- Obtenir la version « finale » complète (avec section 00 et sections 8.2 à 25 réécrites) si elle existe : le fichier fourni est la reconstruction sans les amendements.
