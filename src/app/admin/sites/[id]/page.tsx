import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timeline } from "@/components/ui/timeline";
import { Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { CHANGE_STATUS, SITE_STATUS } from "@/lib/labels";
import { fmtDateShort } from "@/lib/format";
import { SiteForms } from "./forms";
import { addAssetRequest, syncSearchConsole, generateRecap } from "../actions";
import { searchConsoleConfigured, listProperties } from "@/lib/google-search";
import { connectedGoogleEmail } from "@/lib/google-oauth";
import { aiConfigured } from "@/lib/ai";
import { monthLabel } from "@/lib/recaps";

export default async function SiteAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      client: true,
      assets: { orderBy: { createdAt: "asc" } },
      history: { orderBy: { happenedAt: "desc" } },
      changeRequests: { where: { status: { not: "TERMINEE" } }, orderBy: { createdAt: "desc" } },
      subscriptions: { where: { status: "ACTIF" } },
      searchStats: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 1 },
      recaps: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 1 },
    },
  });
  if (!site) notFound();
  const [googleOn, googleEmail, properties] = site.status === "EN_LIGNE" ? await Promise.all([searchConsoleConfigured(), connectedGoogleEmail(), listProperties()]) : [false, null, []];

  return (
    <AdminPage title={site.name} back={{ href: `/admin/clients/${site.clientId}`, label: site.client.name }} action={<Badge tone={SITE_STATUS[site.status].tone}>{SITE_STATUS[site.status].label}</Badge>}>
      <SectionTitle emoji="🔑">Clé formulaire</SectionTitle>
      <Card className="py-3">
        <code className="break-all text-sm text-text-strong">{site.siteKey}</code>
        <p className="mt-1 text-xs text-muted">Point d’entrée : <code>POST {process.env.NEXT_PUBLIC_APP_URL}/api/forms/{site.siteKey}</code></p>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-title">Snippet à coller dans le site</summary>
          <pre className="mt-2 max-h-72 overflow-auto rounded-sm border border-border bg-bg p-3 text-[11px] leading-relaxed text-text-strong">{snippet(site.siteKey)}</pre>
          <p className="mt-2 text-xs text-muted">Version complète (HTML et React) dans le dossier <code>snippets/</code> du projet.</p>
        </details>
      </Card>

      <SectionTitle emoji="🧩">Modules actifs</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {site.subscriptions.length === 0 && <p className="text-sm text-text">Aucun abonnement actif sur ce site.</p>}
        {site.subscriptions.map((s) => <Badge key={s.id} tone={s.module === "NONE" ? "neutral" : "green"}>{s.label}</Badge>)}
      </div>

      {site.changeRequests.length > 0 && (
        <>
          <SectionTitle emoji="🛠️">Modifications ouvertes</SectionTitle>
          <div className="grid gap-2">
            {site.changeRequests.map((r) => (
              <Card key={r.id} href="/admin/modifications" className="flex items-center justify-between py-3">
                <p className="font-medium text-title">{r.title}</p>
                <Badge tone={CHANGE_STATUS[r.status].tone}>{CHANGE_STATUS[r.status].label}</Badge>
              </Card>
            ))}
          </div>
        </>
      )}

      {site.status === "EN_LIGNE" && (
        <>
          <SectionTitle emoji="📊">Search Console et récap mensuel</SectionTitle>
          <Card className="space-y-3">
            <p className="text-xs text-text">
              {googleOn ? <>Google connecté{googleEmail ? ` (${googleEmail})` : ""}. {site.searchConsoleProp ? `Propriété : ${site.searchConsoleProp}` : <span className="text-yellow">Choisissez la propriété Search Console dans les paramètres ci-dessous.</span>}</> : <>Mode démo : Google n’est pas connecté (Paramètres → Connecter Google), les chiffres sont simulés.</>}
              {" "}{aiConfigured() ? "Résumés rédigés par Claude." : "Résumés rédigés par gabarit (mode développement, pas de clé Claude)."}
            </p>
            <p className="text-xs text-text">
              Dernier mois synchronisé : {site.searchStats[0] ? monthLabel(site.searchStats[0].year, site.searchStats[0].month) : "aucun"} · Dernier récap : {site.recaps[0] ? `${monthLabel(site.recaps[0].year, site.recaps[0].month)}${site.recaps[0].sentAt ? " (envoyé)" : " (non envoyé)"}` : "aucun"}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <form action={syncSearchConsole.bind(null, site.id)} className="flex items-end gap-2">
                <label className="text-xs text-text">Mois à récupérer<Input name="months" inputMode="numeric" defaultValue={12} className="mt-1 w-20 py-2 text-sm" /></label>
                <SubmitButton size="sm" variant="secondary" pendingLabel="Synchro…">Synchroniser</SubmitButton>
              </form>
              <form action={generateRecap.bind(null, site.id)} className="flex items-end gap-2">
                <label className="flex h-11 items-center gap-2 text-xs text-text"><input type="checkbox" name="notify" className="accent-white" /> Envoyer au client</label>
                <SubmitButton size="sm" pendingLabel="Génération…">Générer le récap du mois dernier</SubmitButton>
              </form>
            </div>
          </Card>
        </>
      )}

      <SiteForms properties={properties} site={{ id: site.id, name: site.name, url: site.url, previewUrl: site.previewUrl, screenshotUrl: site.screenshotUrl, status: site.status, projectStep: site.projectStep, searchConsoleProp: site.searchConsoleProp, googleLocationId: site.googleLocationId }} />

      {site.status === "EN_CREATION" && (
        <>
          <SectionTitle emoji="📎">Éléments demandés au client</SectionTitle>
          <div className="grid gap-2">
            {site.assets.map((a) => (
              <Card key={a.id} className="flex items-center justify-between py-3">
                <p className="text-sm text-title">{a.label}</p>
                {a.storagePath ? <Badge tone="green">Reçu {fmtDateShort(a.uploadedAt!)}</Badge> : <Badge tone="yellow">En attente</Badge>}
              </Card>
            ))}
            <form action={addAssetRequest.bind(null, site.id)} className="flex gap-2">
              <Input name="label" placeholder="Nouvel élément à demander" required />
              <Select name="kind" defaultValue="AUTRE" className="w-32"><option value="LOGO">Logo</option><option value="TEXTE">Texte</option><option value="PHOTO">Photo</option><option value="AUTRE">Autre</option></Select>
              <SubmitButton size="md" variant="secondary">Ajouter</SubmitButton>
            </form>
          </div>
        </>
      )}

      <SectionTitle emoji="🕓">Historique</SectionTitle>
      {site.history.length === 0 ? <p className="text-sm text-text">Vide.</p> : (
        <Timeline items={site.history.map((h) => ({ id: h.id, date: h.happenedAt, title: h.title, description: h.description, items: h.items, tone: h.kind === "CREATION" ? "blue" : h.kind === "MISE_EN_LIGNE" ? "green" : "neutral" }))} />
      )}
    </AdminPage>
  );
}

function snippet(siteKey: string) {
  return `<form id="acco-form" action="${process.env.NEXT_PUBLIC_APP_URL}/api/forms/${siteKey}" method="post">
  <input name="name" placeholder="Votre nom" required>
  <input name="phone" type="tel" placeholder="Téléphone">
  <input name="email" type="email" placeholder="Email">
  <select name="type"><option>Demande de devis</option><option>Rendez-vous</option><option>Question</option></select>
  <textarea name="message" placeholder="Votre message" required></textarea>
  <div style="position:absolute;left:-9999px"><input name="website" tabindex="-1"></div>
  <div class="cf-turnstile" data-sitekey="${process.env.TURNSTILE_SITE_KEY || "TURNSTILE_SITE_KEY"}"></div>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <button type="submit">Envoyer</button>
</form>
<script>
document.getElementById("acco-form").addEventListener("submit", async (e) => {
  e.preventDefault(); const f = e.target; const d = new FormData(f); d.set("pageUrl", location.href);
  const r = await fetch(f.action, { method: "POST", body: d }).then((x) => x.json());
  alert(r.ok ? "Merci ! Nous vous répondons très vite." : "Oups : " + r.error); if (r.ok) f.reset(); window.turnstile && turnstile.reset();
});
</script>`;
}
