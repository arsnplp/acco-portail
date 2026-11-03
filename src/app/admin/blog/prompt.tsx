"use client";

import { useState } from "react";
import { CopyIcon, CheckIcon } from "lucide-react";

/** Prompt à coller à Claude Code à la création d'un site, pour que le blog soit prêt pour la publication automatique. */
export const PROMPT_BLOG = `Ce site doit être prêt pour la publication automatique d'articles de blog par le portail Acco (un article par lundi, poussé dans ce dépôt par Claude, publié par le VPS). Vérifie et mets en place, sans casser l'existant :

1. Dossier blog/ à la racine servie du site, avec blog/index.html : page « Blog » dans le style du site (même en-tête, pied de page, feuille de style, polices), qui liste les articles (titre, date, 2 lignes de résumé, lien). Vide au départ mais déjà intégrée.
2. Lien « Blog » dans la navigation principale et dans le pied de page, vers /blog/.
3. Gabarit d'article : blog/_gabarit.html (non listé) montrant la structure attendue d'un article : <title>, <meta name="description">, balises Open Graph (og:title, og:description, og:url, og:type=article), h1 unique, sections h2, paragraphes, liens internes vers les pages du site, bloc final « Contactez-nous » avec téléphone, adresse et lien vers la page contact, fil d'Ariane Accueil › Blog › Article. Les futurs articles seront créés à l'emplacement blog/<slug>.html en copiant ce gabarit.
4. SEO local : sur chaque page, nom de l'entreprise, ville et secteur dans <title> et meta description ; données structurées JSON-LD LocalBusiness (nom, adresse, téléphone, horaires si connus) sur l'accueil ; sitemap.xml qui inclut /blog/ et doit accepter de nouvelles lignes ; robots.txt qui autorise /blog/.
5. Pages internes stables pour le maillage : /index.html, /services (ou équivalent), /contact. Si les chemins diffèrent, note-les dans blog/_gabarit.html en commentaire HTML en tête de fichier, sous la forme <!-- maillage : accueil=/ ; services=/services.html ; contact=/contact.html -->.
6. Un commentaire HTML en tête de blog/index.html qui explique comment ajouter un article à la liste (balise à dupliquer), pour que l'ajout automatique reste simple.
7. Cocon sémantique : à partir de l'activité, de la ville et des services réels de l'entreprise, définis le mot-clé principal du site (page d'accueil) et 4 à 8 mots-clés secondaires (un par page de service ou thème : « <service> + <ville> », questions fréquentes des clients, intentions locales). Écris cette liste dans blog/_cocon.md : pour chaque mot-clé, la page pilier correspondante, les sujets d'articles de blog qui l'alimentent (3 à 5 idées par thème) et les liens à faire entre eux (article → page pilier, page pilier → articles, accueil → pages piliers). Les pages existantes doivent respecter ce cocon : chaque page cible UN mot-clé, title et h1 le reprennent, les liens internes suivent la hiérarchie, les ancres de liens contiennent le mot-clé visé plutôt que « cliquez ici ». Les articles de blog publiés par le portail devront reprendre ces mots-clés et pointer vers leur page pilier : blog/_cocon.md sert de référence et ne doit rien inventer (pas de mots-clés hors de l'activité réelle).
8. Ne touche ni au déploiement, ni aux fichiers de configuration, ni au formulaire de contact existant.

Résume en fin de réponse : chemins créés, chemins des pages pour le maillage, les mots-clés du cocon, et tout ce qui manque (ville, horaires, téléphone, services) pour le SEO local.`;

export function PromptBlog() {
  const [ok, setOk] = useState(false);
  return (
    <details className="rounded-card border border-border bg-surface">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-title">Prompt à coller à Claude quand tu crées un site (préparer le blog)</summary>
      <div className="space-y-2 border-t border-border p-4">
        <p className="text-xs text-text">À coller tel quel dans Claude Code, dans le dépôt du site, avant la mise en ligne. Ensuite : renseigner le dépôt GitHub et l’URL sur la fiche du site, et l’abonnement blog sur la fiche client.</p>
        <textarea readOnly value={PROMPT_BLOG} className="h-64 w-full rounded-card border border-border bg-bg p-3 font-mono text-xs leading-relaxed text-text-strong" />
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(PROMPT_BLOG); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* sélection manuelle */ } }} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold text-title hover:border-text">{ok ? <><CheckIcon size={14} /> Copié</> : <><CopyIcon size={14} /> Copier le prompt</>}</button>
      </div>
    </details>
  );
}
