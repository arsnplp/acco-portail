# Portail client Acco

Espace client d'Acco (agence web, Paris) : sites, demandes de clients, résultats Google, modifications, messages, offres.

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · Prisma 6 + PostgreSQL (Supabase, Francfort) · Supabase Auth (lien magique) · Supabase Storage · Resend · PWA.

## Démarrer en local

```bash
npm install
cp .env.example .env        # puis remplir les clés (voir commentaires)
npx prisma migrate deploy   # applique les migrations (schéma + RLS)
npm run db:seed             # équipe + 2 clients de démo + 3 sites
npm run dev                 # http://localhost:3000
```

Connexion : email + mot de passe. Première connexion ou mot de passe oublié : lien par email (via Resend) puis choix du mot de passe. En dev, générer un lien sans email :

```bash
node --env-file=.env scripts/lien-connexion.mjs arsene@acco-lab.fr
# ouvre le lien affiché dans le navigateur
```

Comptes de démo : `demo.boulangerie@acco-lab.fr` (2 sites en ligne), `demo.plombier@acco-lab.fr` (1 site en création).

## Structure

```
prisma/            schéma + migrations (dont RLS en SQL)
src/app/(client)   Accueil · Mes sites · Offres · Messages · Mon compte
src/app/admin      espace équipe
src/app/connexion  connexion par lien magique
src/app/auth       callback + déconnexion
src/components     UI (tokens Acco uniquement) et navigation
src/lib            prisma, supabase, auth, formats
src/proxy.ts       protection des routes + rafraîchissement de session
```

## Charte

Tokens dans `src/app/globals.css` : fond `#0e0e0f`, cartes `#1a1a1b`, bordures `#252729`, texte `#7a7d85`, accents bleu `#6f839e`, rose `#d46a6a`, jaune `#e3d59b`, vert `#9fb6a3`. Titres Poppins 800, texte Inter. Aucune autre couleur.

## Tâches planifiées

Routes protégées par `CRON_SECRET` : `/api/cron/monitor` (5 min), `/api/cron/reviews` (6 h), `/api/cron/recaps` (le 4 du mois), `/api/cron/rgpd` (nuit). Détail dans `DEPLOIEMENT.md`.

## Étapes

1. ✅ Fondations : projet, schéma, auth, rôles, RLS, layout mobile, données de démo
2. ✅ Mes sites + page site + Modifications + historique + admin clients/sites/kanban
3. ✅ Messages + Documents + Mon compte + invitations
4. ✅ Offres, promos, commandes, modules
5. ✅ Formulaires → Activité + notifications
6. ✅ Search Console + récaps mensuels
7. ✅ Avis Google (mode démo) + réponse IA
8. ✅ Recommandations + avis Acco + Accueil en fil
9. ✅ Surveillance, RGPD, PWA, déploiement VPS (voir `DEPLOIEMENT.md`)
