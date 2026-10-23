import { redirect } from "next/navigation";
import { Check, Upload, ExternalLink, FileCheck2 } from "lucide-react";
import { requireClientSite } from "@/lib/sites";
import { prisma } from "@/lib/prisma";
import { PROJECT_STEPS } from "@/lib/labels";
import { Card, SectionTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Timeline } from "@/components/ui/timeline";
import { cn } from "@/lib/cn";
import { uploadAsset, validateMockup } from "./actions";
import { AutoUploadInput } from "@/components/ui/auto-upload";
import { fmtDateShort } from "@/lib/format";
import { ClockIcon, ConstructionIcon, PaperclipIcon } from "lucide-react";

export default async function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site } = await requireClientSite(id);
  if (site.status !== "EN_CREATION") redirect(`/sites/${site.id}/activite`);

  const [assets, history] = await Promise.all([
    prisma.siteAsset.findMany({ where: { siteId: site.id }, orderBy: { createdAt: "asc" } }),
    prisma.siteHistoryEntry.findMany({ where: { siteId: site.id }, orderBy: { happenedAt: "desc" } }),
  ]);
  const stepIndex = PROJECT_STEPS.findIndex((s) => s.key === site.projectStep);
  const missing = assets.filter((a) => !a.storagePath).length;

  return (
    <div>
      <SectionTitle icon={ConstructionIcon}>Avancement</SectionTitle>
      <Card>
        <ol className="grid grid-cols-4 gap-1">
          {PROJECT_STEPS.map((s, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            return (
              <li key={s.key} className="flex flex-col items-center gap-2 text-center">
                <span className={cn("h-1.5 w-full rounded-full", done || current ? "bg-green" : "bg-border", current && "bg-yellow")} />
                <span className={cn("text-[11px] leading-tight", current ? "text-title font-semibold" : done ? "text-text-strong" : "text-muted")}>{s.label}</span>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-sm text-text">
          {site.projectStep === "BRIEF" && "Nous préparons votre projet à partir de notre échange."}
          {site.projectStep === "MAQUETTE" && "Votre maquette est prête : regardez-la et validez-la pour lancer le développement."}
          {site.projectStep === "DEVELOPPEMENT" && "Votre site est en cours de développement."}
          {site.projectStep === "MISE_EN_LIGNE" && "Dernières vérifications avant la mise en ligne."}
        </p>
      </Card>

      {site.previewUrl && (
        <Card className="mt-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-title">Voir l’avancée du site</p>
            <p className="text-sm text-text">Version de travail, pas encore publique.</p>
          </div>
          <Button variant="secondary" size="sm" href={site.previewUrl}>
            Ouvrir <ExternalLink size={14} />
          </Button>
        </Card>
      )}

      {site.projectStep === "MAQUETTE" && !site.mockupValidatedAt && (
        <form action={validateMockup.bind(null, site.id)} className="mt-3">
          <SubmitButton size="lg" className="w-full" pendingLabel="Validation…">
            <FileCheck2 size={18} /> Valider la maquette
          </SubmitButton>
          <p className="mt-2 text-center text-xs text-muted">Une remarque ? Écrivez-nous dans Messages avant de valider.</p>
        </form>
      )}

      <SectionTitle icon={PaperclipIcon}>Éléments à nous fournir</SectionTitle>
      <p className="-mt-1 mb-3 text-sm text-text">{missing === 0 ? "Tout est là, merci !" : `${missing} élément${missing > 1 ? "s" : ""} manquant${missing > 1 ? "s" : ""}.`}</p>
      <div className="grid gap-2">
        {assets.map((a) => (
          <Card key={a.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-medium text-title">{a.label}</p>
              <p className="truncate text-xs text-text">
                {a.storagePath ? `Reçu le ${fmtDateShort(a.uploadedAt!)} · ${a.fileName}` : "Pas encore reçu"}
              </p>
            </div>
            {a.storagePath ? (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-green"><Check size={16} /></span>
            ) : (
              <form action={uploadAsset.bind(null, site.id, a.id)}>
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-card border border-border px-3 text-sm font-semibold text-title hover:bg-surface-2">
                  <Upload size={14} /> Envoyer
                  <AutoUploadInput accept="image/*,.pdf,.doc,.docx,.txt" />
                </label>
              </form>
            )}
          </Card>
        ))}
      </div>

      {history.length > 0 && (
        <>
          <SectionTitle icon={ClockIcon}>Historique</SectionTitle>
          <Timeline items={history.map((h) => ({ id: h.id, date: h.happenedAt, title: h.title, description: h.description, items: h.items, tone: "blue" }))} />
        </>
      )}
    </div>
  );
}
