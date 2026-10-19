import { LegalPage } from "@/components/legal";

export const metadata = { title: "Mentions légales" };

export default function MentionsLegales() {
  return (
    <LegalPage title="Mentions légales">
      <h2>Éditeur</h2>
      <p>Ce portail est édité par <strong>Acco</strong>, agence web, Paris. Contact : <a href="mailto:contact@acco-lab.fr">contact@acco-lab.fr</a>.<br />
        <span className="text-muted">[À compléter : forme juridique, capital, SIREN, adresse du siège, numéro de TVA, directeur de la publication.]</span></p>
      <h2>Hébergement</h2>
      <p>Application hébergée sur un serveur situé dans l’Union européenne (Hostinger International Ltd.). Base de données et fichiers hébergés par Supabase Inc., région Francfort (Allemagne). Emails envoyés par Resend (région Union européenne).</p>
      <h2>Propriété intellectuelle</h2>
      <p>L’ensemble des éléments du portail (textes, interface, code, marque Acco) est protégé. Toute reproduction sans accord écrit est interdite. Les contenus déposés par les clients (textes, photos, documents) restent leur propriété.</p>
      <h2>Accès au service</h2>
      <p>Le portail est réservé aux clients d’Acco et à leurs collaborateurs invités. Acco s’efforce d’assurer une disponibilité continue mais ne peut la garantir, notamment lors des opérations de maintenance.</p>
    </LegalPage>
  );
}
