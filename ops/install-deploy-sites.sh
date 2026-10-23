#!/usr/bin/env bash
# Installe la mise en ligne automatique des sites clients sur le VPS.
# Principe : toutes les minutes, le serveur regarde GitHub. Si la branche d'un
# site a avancé, il met le dossier à jour (fast-forward uniquement).
# Sécurités : jamais de reset --hard. Si un dossier a des modifs locales ou un
# historique différent de GitHub, le site est ignoré et c'est noté dans le log.
set -euo pipefail

cat > /usr/local/bin/deploy-sites <<'SCRIPT'
#!/usr/bin/env bash
# Usage : deploy-sites check            -> état de chaque site, ne modifie rien
#         deploy-sites run              -> met à jour les sites en retard sur GitHub
#         deploy-sites adopt NOM        -> montre les différences copie serveur / GitHub
#         deploy-sites adopt NOM --yes  -> remplace la copie par un clone GitHub (sauvegarde gardée)
set -uo pipefail
MODE="${1:-check}"
# nom | dossier servi par nginx | branche | dépôt GitHub
SITES="
maisonchantal|/var/www/maisonchantal|main|https://github.com/arsnplp/maisonChantal.git
swella|/var/www/swella|main|https://github.com/arsnplp/swella.git
graindedouceur|/var/www/graindedouceur|main|https://github.com/arsnplp/GrainDeDouceur.git
glamour-nails|/var/www/glamour-nails.fr|main|https://github.com/arsnplp/glamoursNails.git
holeen-family|/var/www/holeen-family.com|main|https://github.com/arsnplp/holeen2.git
midpjardin|/var/www/jardinier1|main|https://github.com/arsnplp/jardinier1.git
nuisiblesecure|/var/www/nuisible2|main|https://github.com/arsnplp/nuisible2.git
emmabella|/var/www/emmabella|main|https://github.com/arsnplp/Emmabella.git
acco-lab|/var/www/acco-lab.fr|main|https://github.com/arsnplp/Acco.git
poke-dore|/var/www/poke-dore.fr|main|https://github.com/arsnplp/pok-dor-.git
loratma|/var/www/loratma/loratma|version-deux|https://github.com/arsnplp/loratma.git
fpnaturenuisible|/var/www/fpnuisible|main|https://github.com/arsnplp/fpnuisible.git
bycarlybeauty|/var/www/carla|master|https://github.com/arsnplp/site-rdv2.git
"
G="git -c safe.directory=*"
log(){ echo "$(date '+%F %T') $*"; }

if [ "$MODE" = "adopt" ]; then
  LINE=$(echo "$SITES" | grep "^${2:-x}|") || { echo "Site inconnu : ${2:-}"; exit 1; }
  IFS='|' read -r NAME DIR BR REPO <<< "$LINE"
  if $G -C "$DIR" rev-parse --git-dir >/dev/null 2>&1 && [ "$($G -C "$DIR" rev-parse --show-toplevel)" = "$DIR" ]; then
    echo "$NAME est déjà un clone git, rien à faire."; exit 0; fi
  TMP="$DIR.new-$(date +%s)"
  git clone -q -b "$BR" "$REPO" "$TMP" || { echo "Clone impossible"; exit 1; }
  echo "=== Différences entre le serveur ($DIR) et GitHub ($REPO, $BR) :"
  diff -rq --exclude=.git "$DIR" "$TMP" | sed "s#$TMP#GITHUB#; s#$DIR#SERVEUR#" | head -100
  if [ "${3:-}" = "--yes" ]; then
    BAK="$DIR.bak-$(date +%Y%m%d-%H%M)"
    chown -R --reference="$DIR" "$TMP" 2>/dev/null
    mv "$DIR" "$BAK" && mv "$TMP" "$DIR"
    echo "FAIT : $DIR est maintenant un clone GitHub. Ancienne copie gardée dans $BAK"
    echo "(retour arrière : rm -rf $DIR && mv $BAK $DIR)"
  else
    rm -rf "$TMP"
    echo; echo "Rien n'a été modifié. Pour appliquer : deploy-sites adopt $NAME --yes"
  fi
  exit 0
fi

echo "$SITES" | while IFS='|' read -r NAME DIR BR REPO; do
  [ -z "$NAME" ] && continue
  if [ ! -d "$DIR" ]; then log "$NAME : DOSSIER INTROUVABLE ($DIR)"; continue; fi
  if ! $G -C "$DIR" rev-parse --git-dir >/dev/null 2>&1 || [ "$($G -C "$DIR" rev-parse --show-toplevel)" != "$DIR" ]; then
    [ "$MODE" = "check" ] && log "$NAME : copie simple, pas un clone git -> deploy-sites adopt $NAME"; continue; fi
  if ! timeout 30 $G -C "$DIR" fetch -q origin "$BR" 2>/dev/null; then log "$NAME : fetch impossible - ignoré"; continue; fi
  CUR=$($G -C "$DIR" rev-parse --abbrev-ref HEAD)
  DIRTY=$($G -C "$DIR" status --porcelain --untracked-files=no | wc -l)
  BEHIND=$($G -C "$DIR" rev-list --count HEAD..origin/"$BR")
  AHEAD=$($G -C "$DIR" rev-list --count origin/"$BR"..HEAD)
  if [ "$MODE" = "check" ]; then
    log "$NAME : branche=$CUR  modifs_locales=$DIRTY  en_retard=$BEHIND  en_avance=$AHEAD"
    [ "$BEHIND" -gt 0 ] && $G -C "$DIR" log --oneline HEAD..origin/"$BR" | head -10 | sed 's/^/      à publier : /'
    [ "$DIRTY" -gt 0 ] && $G -C "$DIR" status --porcelain --untracked-files=no | head -10 | sed 's/^/      modifié sur le serveur : /'
    continue
  fi
  [ "$BEHIND" -eq 0 ] && continue
  if [ "$CUR" != "$BR" ] || [ "$DIRTY" -gt 0 ] || [ "$AHEAD" -gt 0 ]; then
    log "$NAME : BLOQUÉ (branche=$CUR modifs_locales=$DIRTY en_avance=$AHEAD) - rien n'a été touché"; continue
  fi
  if $G -C "$DIR" merge -q --ff-only origin/"$BR"; then
    log "$NAME : mis en ligne $($G -C "$DIR" rev-parse --short HEAD)"
  else
    log "$NAME : échec du fast-forward - rien n'a été touché"
  fi
done
SCRIPT
chmod 755 /usr/local/bin/deploy-sites

cat > /usr/local/bin/deploy-sites-enable <<'EN'
#!/usr/bin/env bash
echo '* * * * * root flock -n /run/deploy-sites.lock /usr/local/bin/deploy-sites run >> /var/log/deploy-sites.log 2>&1' > /etc/cron.d/deploy-sites
chmod 644 /etc/cron.d/deploy-sites; touch /var/log/deploy-sites.log
echo "Mise en ligne automatique ACTIVÉE (toutes les minutes). Log : tail -f /var/log/deploy-sites.log"
EN
chmod 755 /usr/local/bin/deploy-sites-enable

echo "Script installé (rien n'est encore automatique). État actuel des sites :"
/usr/local/bin/deploy-sites check
echo
echo "--- acsms.fr : déployé par GitHub Actions (repo ACS), géré à part."
echo
echo "Si tout est OK, activer avec : deploy-sites-enable   (désactiver : rm /etc/cron.d/deploy-sites)"
