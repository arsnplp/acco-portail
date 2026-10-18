# Intégrer le formulaire Acco dans un site client

Chaque site a une **clé formulaire** (admin Acco → Sites → le site). Les envois arrivent dans l'onglet **Activité** du client, avec notification push + email.

- `formulaire-acco.html` : HTML + JS sans dépendance, pour un site statique.
- `AccoForm.tsx` : composant React / Next.js.

Point d'entrée : `POST https://app.acco-lab.fr/api/forms/<siteKey>` (JSON ou `multipart/form-data`).

| Champ | Obligatoire | Note |
| --- | --- | --- |
| `name` | oui | |
| `message` | oui | |
| `email`, `phone`, `type`, `pageUrl` | non | |
| `website` | non | champ piège : doit rester vide |
| `cf-turnstile-response` | oui en prod | jeton Cloudflare Turnstile |

Réponses : `{ ok: true }` · `400` champ manquant · `403` captcha refusé · `429` trop d'envois (5 / 10 min / IP).
