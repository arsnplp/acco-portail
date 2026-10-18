import Link from "next/link";
import { ChevronLeft, Plus } from "lucide-react";
import { requireClientSite, siteHealth } from "@/lib/sites";
import { Badge } from "@/components/ui/badge";
import { SITE_STATUS } from "@/lib/labels";
import { SiteTabs } from "./site-tabs";

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site } = await requireClientSite(id);
  const online = site.status === "EN_LIGNE";
  const health = online ? await siteHealth(site.id) : null;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 pb-nav">
      <div className="px-4 pt-4">
        <Link href="/sites" className="inline-flex items-center gap-1 text-sm text-text hover:text-title">
          <ChevronLeft size={16} /> Mes sites
        </Link>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl truncate">{site.name}</h1>
            {site.url && (
              <a href={site.url} target="_blank" rel="noreferrer" className="text-sm text-text underline-offset-2 hover:underline">
                Voir le site ↗
              </a>
            )}
          </div>
          <Badge tone={SITE_STATUS[site.status].tone}>{SITE_STATUS[site.status].label}</Badge>
        </div>

        {online && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Health label="En ligne" ok={health?.up ?? null} />
            <Health label="Sécurisé" ok={health?.secure ?? null} />
            <Health label="Rapide" ok={health?.fast ?? null} />
          </div>
        )}
      </div>

      <SiteTabs siteId={site.id} enabled={online} />

      <div className="px-4 pt-5">{children}</div>

      {online && (
        <Link
          href={`/sites/${site.id}/modifications/nouvelle`}
          aria-label="Nouvelle demande de modification"
          className="fixed z-40 right-4 flex size-14 items-center justify-center rounded-full bg-title text-bg shadow-lg shadow-black/40 active:scale-95 transition-transform"
          style={{ bottom: "calc(var(--nav-h) + env(safe-area-inset-bottom) + 16px)" }}
        >
          <Plus size={26} strokeWidth={2.25} />
        </Link>
      )}
    </main>
  );
}

function Health({ label, ok }: { label: string; ok: boolean | null }) {
  const tone = ok === null ? "bg-muted" : ok ? "bg-green" : "bg-pink";
  return (
    <div className="flex items-center gap-2 rounded-card border border-border bg-surface px-3 py-2.5">
      <span className={`size-2 rounded-full ${tone}`} />
      <span className="text-sm text-text-strong">{label}</span>
    </div>
  );
}
