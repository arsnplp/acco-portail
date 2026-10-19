# Déploiement du portail Acco sur le VPS Hostinger

Cible : `https://app.acco-lab.fr`, VPS Hostinger (Ubuntu 22.04 ou 24.04), Node.js 22+, nginx + certbot, PM2.
Durée : environ 45 minutes la première fois. Les commandes se tapent dans le terminal du VPS (Hostinger → VPS → « Terminal du navigateur », ou `ssh root@IP_DU_VPS`).

## 0. DNS

Chez le registrar de `acco-lab.fr` (probablement Hostinger aussi) : ajouter un enregistrement **A** `app` → IP du VPS. Attendre quelques minutes.

## 1. Préparer le serveur

```bash
apt update && apt upgrade -y
apt install -y nginx certbot python3-certbot-nginx git ufw curl
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
npm install -g pm2
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

Créer un utilisateur dédié (plus sûr que root) :

```bash
adduser --disabled-password --gecos "" acco
usermod -aG sudo acco
su - acco
```

## 2. Récupérer le code

Le dépôt est public, donc un simple clone suffit. S'il devient privé : créer un « deploy key » GitHub (Settings → Deploy keys) avec la clé publique du VPS (`ssh-keygen -t ed25519`).

```bash
cd ~ && git clone https://github.com/arsnplp/acco-portail.git
cd acco-portail && npm ci
```

## 3. Variables d'environnement

```bash
cp .env.example .env && nano .env
```

Copier les valeurs du `.env` local, **sauf** :

- `NEXT_PUBLIC_APP_URL=https://app.acco-lab.fr`
- vérifier `CRON_SECRET` (une valeur longue au hasard, `openssl rand -hex 24`).

## 4. Base de données et premier build

La base Supabase est déjà en place et migrée. Pour appliquer d'éventuelles nouvelles migrations puis construire :

```bash
npx prisma migrate deploy
npx prisma generate
npm run build
```

## 5. Lancer avec PM2

```bash
pm2 start npm --name acco -- start -- -p 3000
pm2 save
pm2 startup   # copier-coller la commande affichée (elle commence par sudo env PATH=...)
```

Vérifier : `curl -I http://localhost:3000/connexion` doit répondre `200`.

## 6. nginx + HTTPS

```bash
sudo tee /etc/nginx/sites-available/acco > /dev/null <<'NGINX'
server {
    server_name app.acco-lab.fr;
    client_max_body_size 30m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300;
    }
}
NGINX
sudo ln -s /etc/nginx/sites-available/acco /etc/nginx/sites-enabled/acco
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.acco-lab.fr --redirect -m contact@acco-lab.fr --agree-tos -n
```

Certbot renouvelle tout seul (`systemctl status certbot.timer`).

## 7. Côté Supabase et Google (une seule fois)

- Supabase → Authentication → URL Configuration : **Site URL** `https://app.acco-lab.fr`, et `https://app.acco-lab.fr/**` dans les Redirect URLs (déjà ajouté).
- Google Cloud → Identifiants → l'ID client OAuth : `https://app.acco-lab.fr/api/google/callback` est déjà dans les URI de redirection. Reconnecter Google depuis Paramètres une fois en production (le jeton est en base, il suit).

## 8. Tâches planifiées (cron)

`crontab -e` avec l'utilisateur `acco`, en remplaçant `LE_SECRET` par la valeur de `CRON_SECRET` :

```cron
SECRET=LE_SECRET
URL=https://app.acco-lab.fr/api/cron
*/5 * * * *  curl -s -H "Authorization: Bearer $SECRET" $URL/monitor  > /dev/null
0 */6 * * *  curl -s -H "Authorization: Bearer $SECRET" $URL/reviews  > /dev/null
0 7 4 * *    curl -s -H "Authorization: Bearer $SECRET" $URL/recaps   > /dev/null
30 3 * * *   curl -s -H "Authorization: Bearer $SECRET" $URL/rgpd     > /dev/null
```

| Tâche | Quand | Rôle |
| --- | --- | --- |
| monitor | toutes les 5 min | site répond, temps de réponse, SSL → voyants « État du site », alertes équipe |
| reviews | toutes les 6 h | nouveaux avis Google (module Avis) |
| recaps | le 4 du mois à 7 h | chiffres Search Console du mois écoulé + récap envoyé aux clients |
| rgpd | chaque nuit | suppression des demandes de contact de plus de 24 mois |

## 9. Mettre à jour l'app

```bash
cd ~/acco-portail && git pull && npm ci && npx prisma migrate deploy && npm run build && pm2 restart acco
```

Astuce : enregistrer ces commandes dans `~/deploy.sh` et lancer `bash ~/deploy.sh`.

## 10. Vérifications après déploiement

1. `https://app.acco-lab.fr/connexion` s'affiche avec le cadenas.
2. Se connecter avec `arsene@acco-lab.fr` : l'email de lien magique arrive (Resend).
3. Ajouter l'app à l'écran d'accueil d'un iPhone, puis activer les notifications dans Mon compte.
4. Envoyer un formulaire de test : `curl -X POST https://app.acco-lab.fr/api/forms/<clé> -d name=Test -d message=Bonjour`.
5. `pm2 logs acco` pour voir les journaux, `pm2 monit` pour la charge.

## Dépannage

- **502 Bad Gateway** : l'app ne tourne pas → `pm2 status`, `pm2 logs acco`.
- **Lien magique qui renvoie « lien invalide »** : vérifier `NEXT_PUBLIC_APP_URL` et les Redirect URLs Supabase.
- **Emails non reçus** : Resend → Logs ; vérifier que le domaine `acco-lab.fr` est toujours « verified ».
- **Build qui échoue par manque de mémoire** (VPS 1 Go) : ajouter du swap `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`.
