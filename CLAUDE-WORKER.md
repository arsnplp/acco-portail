# Claude Code sur les demandes de modification

Dans **Admin → Modifications** :

1. Une demande passe en **En cours** → bouton **« Confier à Claude »**.
2. Le worker (sur le Mac) clone le dépôt du site, crée la branche `claude/modif-…`, lance Claude Code
   (lecture/écriture de fichiers **uniquement dans le dossier du site**, aucune commande, pas de `.git`,
   `.github/`, `deploy/`, `.env`, `*.conf`), commit et pousse la branche.
3. La carte passe dans **À valider** : compte rendu de Claude, bouton **Aperçu** (`http://localhost:43xx`,
   un port par demande), lien **Changements** (diff GitHub), bouton **Refaire** avec consignes, bouton
   **Annuler la modif** (supprime la branche et l'aperçu, la carte revient en « En cours », le site en ligne
   n'est pas touché).
4. Glisser dans **Terminée** (ou « Mettre en ligne ») → le worker fusionne la branche dans la branche
   publiée et pousse. Le VPS publie dans la minute (`deploy-sites`, voir `ops/`). Historique du site et
   notification client sont créés à ce moment-là. En cas de conflit, la carte revient dans « À valider ».

Côté client, « À valider » s'affiche comme « En cours ».

## Installation (une fois)

0. **Clé API** : Admin → Paramètres → « 🛠️ Claude Code (modifications des sites) » → coller la clé
   Anthropic (vérifiée avant enregistrement) et cocher *Activer*. Sans ça, le bouton « Confier à Claude »
   renvoie vers Paramètres.

1. **Base de données** (depuis le Mac, `.env` du portail) :
   ```bash
   npx prisma migrate deploy && npx prisma generate
   ```
2. **Déployer le portail** sur le VPS (procédure habituelle, voir `DEPLOIEMENT.md`).
3. **Fiche de chaque site** (Admin → Sites → site) : renseigner *Dépôt GitHub*, *Branche publiée*
   (vide = `main`) et *Dossier servi en ligne* (vide = racine).

## Lancer le worker (sur le Mac)

```bash
cd acco-portail && npm install
npm run claude:worker
```

Laisser la fenêtre ouverte : les demandes ne sont traitées (et les aperçus visibles) que quand il tourne.
Ctrl+C pour arrêter (il finit la tâche en cours).

Il utilise :
- `.env` du portail : `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (pièces jointes) ;
- la clé de Paramètres (repli : `CLAUDE_CODE_API_KEY` du `.env`) ;
- `CRON_SECRET` (même valeur que sur le VPS) pour que le portail envoie au client le push/email « modification en ligne » ;
- les identifiants git du Mac pour pousser sur GitHub.

Options (`.env`) : `CLAUDE_WORKDIR` (défaut `~/.acco-claude`), `CLAUDE_PREVIEW_PORT` (défaut `4321`),
`CLAUDE_MAX_BUDGET_USD` (défaut `5` par demande), `CLAUDE_MODEL`.

## Limites

- Aperçu = fichiers statiques du dépôt. Pour un site qui se compile (Astro, Next…), l'aperçu montre les
  sources, pas le site final ; la mise en ligne fonctionne quand même si le dépôt se déploie tout seul.
- Un seul worker à la fois.
