import { ClipboardListIcon } from "lucide-react";
import { requireClientSite } from "@/lib/sites";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/field";
import { BRIEF_SECTIONS, ETAT_SECTION, chargerBrief, lireContenu, sectionDe } from "@/lib/brief";
import { saveBriefSectionClient } from "../actions";

export const metadata = { title: "Brief" };

/** Brief côté client (10.3, 14.3) : il complète ce qui manque, section par section ; l'équipe valide. */
export default async function BriefClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site } = await requireClientSite(id);
  const brief = await chargerBrief(site.id);
  const contenu = lireContenu(brief.contenu);
  const sections = BRIEF_SECTIONS.filter((s) => s.client);
  const manquantes = sections.filter((s) => sectionDe(contenu, s.key).etat === "ATTENDU" || sectionDe(contenu, s.key).etat === "INCOMPLET").length;
  return (
    <div>
      <SectionTitle icon={ClipboardListIcon}>Votre brief</SectionTitle>
      <p className="-mt-2 mb-3 text-sm text-text">{brief.etat === "VALIDE" ? "Votre brief est validé : merci ! Nous préparons la maquette." : manquantes === 0 ? "Tout est reçu. Notre équipe relit et valide." : `${manquantes} section${manquantes > 1 ? "s" : ""} à compléter. Écrivez simplement, nous mettrons en forme.`}</p>
      <div className="grid gap-3">
        {sections.map((s) => {
          const sec = sectionDe(contenu, s.key);
          const fige = sec.etat === "VALIDE" || brief.etat === "VALIDE";
          return (
            <Card key={s.key}>
              <div className="flex items-start justify-between gap-2"><p className="font-semibold text-title">{s.label}</p><Badge tone={ETAT_SECTION[sec.etat].tone}>{ETAT_SECTION[sec.etat].label}</Badge></div>
              <p className="mt-0.5 text-xs text-text">{s.aide}</p>
              {fige ? <p className="mt-2 text-sm whitespace-pre-line text-text-strong">{sec.texte || "—"}</p> : (
                <form action={saveBriefSectionClient.bind(null, site.id, s.key)} className="mt-2 space-y-2">
                  <Textarea name="texte" defaultValue={sec.texte} placeholder={s.aide} className="min-h-20 text-sm" />
                  <SubmitButton size="sm" variant="secondary" pendingLabel="…">Enregistrer</SubmitButton>
                </form>
              )}
            </Card>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-muted">Photos, logo et textes longs : déposez-les dans l’onglet Documents.</p>
    </div>
  );
}
