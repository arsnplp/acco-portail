"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLinkIcon, FileSearchIcon, InfoIcon, MapPinIcon } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { COLONNES, ficheGoogle, type Colonne, type LeadRow } from "@/lib/leads/colonnes";

type LeadInfo = { listeId: string; liste: string; generee: string; donnees: LeadRow } | null;

/** Groupes de colonnes pour la fenêtre « Infos du lead ». */
const GROUPES: { titre: string; cols: Colonne[] }[] = [
  { titre: "Contact", cols: ["Entreprise", "Secteur", "Ville", "Adresse", "Téléphone", "Email", "Dirigeant", "Rôle"] },
  { titre: "Réputation et potentiel", cols: ["Fiche Google", "Score", "Note Google", "Avis Google", "Google Ads", "Facebook", "Instagram"] },
  { titre: "Site web", cols: ["Site web", "CMS", "Hébergeur", "Âge domaine", "HTTPS", "Responsive", "Vitesse mobile", "Vitesse desktop", "Score SEO", "Faiblesses SEO"] },
  { titre: "Entreprise (registre officiel)", cols: ["SIREN", "SIRET", "TVA intracom", "Forme juridique", "Code NAF", "Date de création", "État", "Établissements (total)", "Établissements ouverts", "Fiabilité identité"] },
];

function valeur(c: Colonne, v: unknown, d: LeadRow) {
  if (c === "Fiche Google") {
    const f = ficheGoogle(d);
    return f ? <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-blue hover:underline"><MapPinIcon size={14} aria-hidden />{f.exacte ? "Ouvrir la fiche Google" : "Voir sur Google Maps (recherche nom + adresse)"}<ExternalLinkIcon size={11} /></a> : <span className="text-muted">–</span>;
  }
  if (v === null || v === undefined || v === "") return <span className="text-muted">–</span>;
  const s = String(v);
  if (/^https?:\/\//.test(s)) return <a href={s} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-blue hover:underline">{s.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}<ExternalLinkIcon size={11} /></a>;
  if (c === "Téléphone") return <a href={`tel:${s.replace(/\s/g, "")}`} className="hover:underline">{s}</a>;
  if (c === "Faiblesses SEO") return <span>{s.split(" | ").join(" · ")}</span>;
  if (c === "État") return s === "A" ? "Active" : s === "C" ? "Fermée" : s;
  if (c === "Fiabilité identité") return `${s} / 100`;
  return s;
}

export function LeadInfoButton({ lead }: { lead: LeadInfo }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex h-11 items-center gap-2 rounded-card border border-border px-3 text-sm text-text-strong hover:border-text hover:text-title">
        <FileSearchIcon size={16} aria-hidden /> <span className="hidden sm:inline">Infos du lead</span>
      </button>
      {open && (
        <Dialog title="Infos du lead" size="lg" onClose={() => setOpen(false)}>
          {!lead ? (
            <div className="flex gap-3 rounded-card border border-border bg-surface p-4 text-sm text-text-strong">
              <InfoIcon size={18} className="mt-0.5 shrink-0 text-text" aria-hidden />
              <p>Pas d’infos de lead pour cette fiche : elle a été créée à la main (ou importée de l’ancien CRM), elle ne vient pas d’une liste du coffre à leads. Les informations disponibles sont celles de la fiche (bloc Société et contacts).</p>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-sm text-text">
                Issu de la liste <Link href={`/crm/leads/${lead.listeId}`} className="font-semibold text-title hover:underline">{lead.liste}</Link>, générée {lead.generee}.
              </p>
              {GROUPES.map((g) => (
                <section key={g.titre}>
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-text uppercase">{g.titre}</h3>
                  <dl className="grid gap-x-6 gap-y-2 rounded-card border border-border bg-surface p-4 text-sm sm:grid-cols-2">
                    {g.cols.map((c) => (
                      <div key={c} className={c === "Faiblesses SEO" || c === "Adresse" || c === "Fiche Google" ? "sm:col-span-2" : undefined}>
                        <dt className="text-xs text-text">{c}</dt>
                        <dd className="mt-0.5 text-text-strong">{valeur(c, lead.donnees[c], lead.donnees)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
              {lead.donnees._source && <p className="text-xs text-text">Sources : {lead.donnees._source}</p>}
              <p className="text-[11px] text-muted">Colonnes : {COLONNES.length}. Données relevées au moment de la génération.</p>
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}
