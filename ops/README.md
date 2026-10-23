# ops

Scripts serveur (VPS), pas utilisés par l'application.

- `install-deploy-sites.sh` : installe `deploy-sites`, la mise en ligne automatique
  des sites clients (le VPS suit la branche principale de chaque dépôt GitHub,
  fast-forward uniquement). Installation sur le VPS :
  `curl -fsSL https://raw.githubusercontent.com/arsnplp/acco-portail/main/ops/install-deploy-sites.sh | bash`
