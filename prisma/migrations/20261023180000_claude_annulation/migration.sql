-- Bouton « Annuler la modif » : le worker supprime la branche de Claude et l'aperçu
ALTER TYPE "ClaudeJobState" ADD VALUE IF NOT EXISTS 'ANNULATION_DEMANDEE';
