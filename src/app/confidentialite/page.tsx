import { LegalPage } from "@/components/legal";

export const metadata = { title: "Politique de confidentialité" };

export default function Confidentialite() {
  return (
    <LegalPage title="Politique de confidentialité">
      <p>Acco traite des données personnelles pour faire fonctionner cet espace client. Voici lesquelles, pourquoi, et combien de temps.</p>
      <h2>Responsable du traitement</h2>
      <p>Acco, Paris, <a href="mailto:contact@acco-lab.fr">contact@acco-lab.fr</a>. <span className="text-muted">[À compléter : adresse postale.]</span></p>
      <h2>Données traitées et finalités</h2>
      <ul>
        <li><strong>Comptes utilisateurs</strong> (email, prénom, nom) : connexion par lien magique, gestion de l’espace client. Base légale : exécution du contrat.</li>
        <li><strong>Demandes de contact reçues via les sites clients</strong> (nom, téléphone, email, message) : transmises au commerçant concerné, qui en est responsable du traitement ; Acco agit comme sous-traitant. Conservation : <strong>24 mois</strong>, puis suppression automatique.</li>
        <li><strong>Messages, demandes de modification, documents</strong> : suivi de la relation client. Conservation : durée du contrat puis 5 ans (obligations légales et comptables pour les factures et contrats).</li>
        <li><strong>Statistiques de visibilité</strong> (Google Search Console) et <strong>avis Google</strong> : données agrégées ou publiques, affichées au client concerné.</li>
        <li><strong>Recommandations</strong> (nom et coordonnées d’un contact recommandé) : prise de contact commerciale unique. Conservation : 12 mois sans suite.</li>
        <li><strong>Notifications push</strong> : jeton technique de votre appareil, supprimé à la désactivation.</li>
      </ul>
      <h2>Hébergement et sous-traitants</h2>
      <p>Toutes les données sont hébergées dans l’Union européenne : serveur applicatif (Hostinger, UE), base de données et fichiers (Supabase, Francfort), emails (Resend, UE). Les résumés automatiques peuvent être générés par Anthropic (Claude) à partir de chiffres agrégés, sans données personnelles.</p>
      <h2>Vos droits</h2>
      <p>Vous pouvez accéder à vos données, les rectifier, les faire supprimer, vous opposer à un traitement ou demander leur portabilité en écrivant à <a href="mailto:contact@acco-lab.fr">contact@acco-lab.fr</a>. Vous pouvez aussi saisir la CNIL (cnil.fr).</p>
      <h2>Cookies</h2>
      <p>Le portail n’utilise que des cookies strictement nécessaires à la connexion. Aucun cookie publicitaire ni de mesure d’audience tierce.</p>
      <p className="text-xs text-muted">Dernière mise à jour : octobre 2026.</p>
    </LegalPage>
  );
}
