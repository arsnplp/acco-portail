#!/bin/bash
# Worker Claude en arrière-plan sur le Mac (launchd) : il démarre avec la session, redémarre s'il s'arrête,
# et se met à jour (git pull) à chaque démarrage. Plus besoin du Terminal au quotidien.
#
#   bash scripts/mac-worker.sh installer     # une seule fois
#   bash scripts/mac-worker.sh relancer      # après une mise à jour, ou si le voyant reste « hors ligne »
#   bash scripts/mac-worker.sh journal       # voir ce que fait le worker (Ctrl+C pour quitter)
#   bash scripts/mac-worker.sh statut
#   bash scripts/mac-worker.sh desinstaller
set -euo pipefail

LABEL="fr.acco-lab.claude-worker"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/acco-claude-worker.log"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN="gui/$(id -u)"

case "${1:-}" in
  installer)
    NODE="$(command -v node || true)"
    [ -z "$NODE" ] && { echo "Node.js introuvable : installez-le depuis nodejs.org puis relancez."; exit 1; }
    [ -f "$DIR/.env" ] || { echo "Fichier .env manquant dans $DIR"; exit 1; }
    NODE_DIR="$(dirname "$NODE")"
    mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
    cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string><string>-c</string>
    <string>git pull --ff-only -q || true; if [ package-lock.json -nt node_modules/.package-lock.json ]; then npm install --no-audit --no-fund --silent; fi; npx prisma generate &gt;/dev/null 2&gt;&amp;1; exec npm run claude:worker</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$NODE_DIR:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    launchctl bootstrap "$DOMAIN" "$PLIST"
    echo "✓ Worker Claude installé : il tourne maintenant en arrière-plan et démarrera tout seul avec le Mac."
    echo "  Vérifiez le voyant « Claude prêt sur le Mac » dans Modifications (≈ 30 s)."
    echo "  Journal : bash scripts/mac-worker.sh journal"
    ;;
  relancer)
    launchctl kickstart -k "$DOMAIN/$LABEL" && echo "✓ Worker relancé (mise à jour comprise)." ;;
  journal)
    tail -n 40 -f "$LOG" ;;
  statut)
    if launchctl print "$DOMAIN/$LABEL" >/dev/null 2>&1; then
      launchctl print "$DOMAIN/$LABEL" | grep -E "state =|pid =" | head -2; tail -n 5 "$LOG" 2>/dev/null || true
    else echo "Worker non installé (bash scripts/mac-worker.sh installer)."; fi ;;
  desinstaller)
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
    echo "✓ Worker désinstallé (il ne démarrera plus tout seul)." ;;
  *)
    sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
