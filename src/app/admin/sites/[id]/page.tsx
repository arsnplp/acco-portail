import { isGestionnaire, requireTeam } from "@/lib/auth";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Timeline } from "@/components/ui/timeline";
import { Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { CHANGE_STATUS, SITE_STATUS } from "@/lib/labels";
import { fmtDateShort, daysUntil } from "@/lib/format";
import { parisDay, teamName } from "@/lib/crm";
import { SiteForms } from "./forms";
import { addAssetRequest, syncReviewsAction, checkSiteNow } from "../actions";
import { Dot } from "@/components/ui/badge";
import { businessApiEnabled, getReviewsProvider } from "@/lib/reviews-provider";
import { searchConsoleConfigured, listProperties } from "@/lib/google-search";
import { SyncSearchConsoleForm, RecapHistory } from "./sync-form";
import { connectedGoogleEmail } from "@/lib/google-oauth";
import { aiConfigured } from "@/lib/ai";
import { getSecret } from "@/lib/settings";
import { monthLabel, moisDuRecap, prochainEnvoi } from "@/lib/recaps";
import { ActivityIcon, ChartColumnIcon, ClockIcon, KeyRoundIcon, NewspaperIcon, PaperclipIcon, PuzzleIcon, StarIcon, WrenchIcon } from "lucide-react";
import { ArticleForm, ArticleStatutSelect, DeleteArticleButton } from "@/app/admin/production/blogs";

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
      healthChecks: { orderBy: { checkedAt: "desc" }, take: 12 },
      recaps: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 1 },
      articles: { orderBy: [{ statut: "asc" }, { updatedAt: "desc" }] },
    },
  });
  if (!site) notFound();
  const gestion = isGestionnaire(await requireTeam());
  const devs = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "DEV", "EXPERT", "SPECIALISTE"] } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, email: true } });
  const [googleOn, googleEmail, properties] = gestion && site.status === "EN_LIGNE" ? await Promise.all([searchConsoleConfigured(), connectedGoogleEmail(), listProperties()]) : [false, null, []];
  const avisActive = site.subscriptions.some((x) => x.module === "AVIS");
  const [bizApi, aiOn, turnstileSiteKey] = await Promise.all([businessApiEnabled(), aiConfigured(), getSecret("turnstile_site_key")]);
  const locations = gestion && avisActive && bizApi ? await (await getReviewsProvider()).listLocations().catch(() => []) : [];
  // Récap mensuel : vert si le mois écoulé est synchronisé et l'envoi automatique actif.
  const cible = moisDuRecap();
  const last = site.searchStats[0];
  const synced = site.recapAuto && !!last && last.year === cible.year && last.month === cible.month;
  const [envoisRaw, prochain] = gestion && site.status === "EN_LIGNE"
    ? await Promise.all([
        prisma.monthlyRecap.findMany({ where: { siteId: site.id }, orderBy: [{ year: "desc" }, { month: "desc" }], select: { year: true, month: true, sentAt: true, clicks: true } }),
        prochainEnvoi(site.id),
      ])
    : [[], null];
  const fmtParis = (d: Date, withTime = false) => d.toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
  const envois = envoisRaw.map((r) => ({ mois: monthLabel(r.year, r.month), sentAt: r.sentAt ? fmtParis(r.sentAt) : null, clicks: r.clicks }));
  const prochainTxt = !prochain ? "" : prochain.enRetard ? "dans l’heure (envoi du mois en cours)" : fmtParis(prochain.date, true);
  const reviewCount = avisActive ? await prisma.review.count({ where: { siteId: site.id } }) : 0;

  return (
    <AdminPage title={site.name} back={{ href: `/admin/clients/${site.clientId}`, label: site.client.name }} action={<Badge tone={SITE_STATUS[site.status].tone}>{SITE_STATUS[site.status].label}</Badge>}>
      {site.status === "EN_LIGNE" && site.url && (
        <>
          <SectionTitle icon={ActivityIcon}>État du site</SectionTitle>
          <Card className="space-y-3">
            {site.healthChecks[0] ? (() => {
              const h = site.healthChecks[0];
              const sslDays = h.sslExpiresAt ? daysUntil(h.sslExpiresAt) : null;
              const upRate = Math.round((site.healthChecks.filter((c) => c.isUp).length / site.healthChecks.length) * 100);
              return (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-sm border border-border p-2"><p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-title"><Dot tone={h.isUp ? "green" : "pink"} />{h.isUp ? "En ligne" : "Hors ligne"}</p><p className="text-[11px] text-text">code {h.statusCode ?? "—"} · {upRate} % sur les {site.healthChecks.length} derniers tests</p></div>
                  <div className="rounded-sm border border-border p-2"><p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-title"><Dot tone={sslDays === null ? "neutral" : sslDays > 14 ? "green" : "pink"} />SSL</p><p className="text-[11px] text-text">{sslDays === null ? "non lu" : `expire dans ${sslDays} j`}</p></div>
                  <div className="rounded-sm border border-border p-2"><p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-title"><Dot tone={(h.responseMs ?? 0) < 1500 ? "green" : "yellow"} />{h.responseMs} ms</p><p className="text-[11px] text-text">vérifié {fmtDateShort(h.checkedAt)}</p></div>
                </div>
              );
            })() : <p className="text-sm text-text">Pas encore vérifié. La surveillance tourne toutes les 5 minutes une fois le cron en place.</p>}
            <form action={checkSiteNow.bind(null, site.id)}><SubmitButton size="sm" variant="secondary" pendingLabel="Vérification…">Vérifier maintenant</SubmitButton></form>
          </Card>
        </>
      )}

      <SectionTitle icon={KeyRoundIcon}>Clé formulaire</SectionTitle>
      <Card className="py-3">
        <code className="break-all text-sm text-text-strong">{site.siteKey}</code>
        <p className="mt-1 text-xs text-muted">Point d’entrée : <code>POST {process.env.NEXT_PUBLIC_APP_URL}/api/forms/{site.siteKey}</code></p>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-title">Snippet à coller dans le site</summary>
          <pre className="mt-2 max-h-72 overflow-auto rounded-sm border border-border bg-bg p-3 text-[11px] leading-relaxed text-text-strong">{snippet(site.siteKey, turnstileSiteKey)}</pre>
          <p className="mt-2 text-xs text-muted">Version complète (HTML et React) dans le dossier <code>snippets/</code> du projet.</p>
        </details>
      </Card>

      <SectionTitle icon={PuzzleIcon}>Modules actifs</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {site.subscriptions.length === 0 && <p className="text-sm text-text">Aucun abonnement actif sur ce site.</p>}
        {site.subscriptions.map((s) => <Badge key={s.id} tone={s.module === "NONE" ? "neutral" : "green"}>{s.label}</Badge>)}
      </div>

      {site.changeRequests.length > 0 && (
        <>
          <SectionTitle icon={WrenchIcon}>Modifications ouvertes</SectionTitle>
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

      {gestion && site.status === "EN_LIGNE" && (
        <>
          <SectionTitle icon={ChartColumnIcon}>Search Console et récap mensuel</SectionTitle>
          <Card className="space-y-3">
            <p className="text-xs text-text">
              {googleOn ? <>Google connecté{googleEmail ? ` (${googleEmail})` : ""}. {site.searchConsoleProp ? `Propriété : ${site.searchConsoleProp}` : <span className="text-yellow">Propriété Search Console vide : les chiffres affichés sont une démo. Choisissez-la dans « Paramètres du site » ci-dessous puis Enregistrer.</span>}</> : <>Mode démo : Google n’est pas connecté (Paramètres → Connecter Google), les chiffres sont simulés.</>}
              {" "}{aiOn ? "Résumés rédigés par Claude." : "Résumés rédigés par gabarit (activez Claude dans Paramètres → Clés et services)."}
            </p>
            <p className="text-xs text-text">
              Dernier mois synchronisé : {last ? monthLabel(last.year, last.month) : "aucun"} · Récap mensuel : {site.recapAuto ? <span className="text-green">envoyé automatiquement le 4 de chaque mois</span> : <span className="text-yellow">pas encore automatique, synchronisez pour l’activer</span>}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <SyncSearchConsoleForm siteId={site.id} synced={synced} />
              <RecapHistory envois={envois} prochain={prochainTxt} auto={site.recapAuto} />
            </div>
          </Card>
        </>
      )}

      {gestion && avisActive && (
        <>
          <SectionTitle icon={StarIcon}>Avis Google</SectionTitle>
          <Card className="space-y-2">
            <p className="text-xs text-text">
              {bizApi ? (site.googleLocationId ? `Fiche liée : ${site.googleLocationId}` : <span className="text-yellow">Choisissez la fiche Google dans les paramètres ci-dessous.</span>) : "Mode démo : avis d’exemple tant que Google n’a pas validé l’accès à l’API Business Profile (à activer dans Paramètres → Clés et services)."}
              {" "}{reviewCount} avis en base · dernière synchro : {site.reviewsSyncedAt ? fmtDateShort(site.reviewsSyncedAt) : "jamais"}.
            </p>
            <form action={syncReviewsAction.bind(null, site.id)}><SubmitButton size="sm" variant="secondary" pendingLabel="Synchro…">Synchroniser les avis</SubmitButton></form>
          </Card>
        </>
      )}

      <SectionTitle icon={NewspaperIcon}>Blog <span className="text-sm font-normal text-text">{site.articles.filter((a) => a.statut === "PUBLIE").length} publié{site.articles.filter((a) => a.statut === "PUBLIE").length > 1 ? "s" : ""} · {site.articles.filter((a) => a.statut !== "PUBLIE").length} à faire</span></SectionTitle>
      <ArticleForm siteId={site.id} />
      {site.articles.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-card border border-border bg-surface">
          {site.articles.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-title">{a.url ? <a href={a.url} target="_blank" rel="noreferrer" className="hover:underline">{a.titre}</a> : a.titre}</p>
                <p className="truncate text-xs text-text">{a.publieAt ? `publié le ${fmtDateShort(a.publieAt)}` : `ajouté le ${fmtDateShort(a.createdAt)}`}</p>
              </div>
              <ArticleStatutSelect id={a.id} statut={a.statut} />
              <DeleteArticleButton id={a.id} />
            </li>
          ))}
        </ul>
      )}

      <SiteForms gestion={gestion} properties={properties} locations={locations} devs={devs.map((u) => ({ id: u.id, name: teamName(u) }))} site={{ id: site.id, name: site.name, url: site.url, previewUrl: site.previewUrl, screenshotUrl: site.screenshotUrl, status: site.status, projectStep: site.projectStep, searchConsoleProp: site.searchConsoleProp, googleLocationId: site.googleLocationId, repoUrl: site.repoUrl, repoBranch: site.repoBranch, repoRoot: site.repoRoot, developpeurId: site.developpeurId, deadlineV1: site.deadlineV1 ? parisDay(site.deadlineV1) : "", deadlineV2: site.deadlineV2 ? parisDay(site.deadlineV2) : "", deadlineLivraison: site.deadlineLivraison ? parisDay(site.deadlineLivraison) : "" }} />

      {site.status === "EN_CREATION" && (
        <>
          <SectionTitle icon={PaperclipIcon}>Éléments demandés au client</SectionTitle>
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

      <SectionTitle icon={ClockIcon}>Historique</SectionTitle>
      {site.history.length === 0 ? <p className="text-sm text-text">Vide.</p> : (
        <Timeline items={site.history.map((h) => ({ id: h.id, date: h.happenedAt, title: h.title, description: h.description, items: h.items, tone: h.kind === "CREATION" ? "blue" : h.kind === "MISE_EN_LIGNE" ? "green" : "neutral" }))} />
      )}
    </AdminPage>
  );
}

function snippet(siteKey: string, turnstileSiteKey: string | null) {
  return `<form id="acco-form" action="${process.env.NEXT_PUBLIC_APP_URL}/api/forms/${siteKey}" method="post">
  <input name="name" placeholder="Votre nom" required>
  <input name="phone" type="tel" placeholder="Téléphone">
  <input name="email" type="email" placeholder="Email">
  <select name="type"><option>Demande de devis</option><option>Rendez-vous</option><option>Question</option></select>
  <textarea name="message" placeholder="Votre message" required></textarea>
  <div style="position:absolute;left:-9999px"><input name="website" tabindex="-1"></div>
  <div class="cf-turnstile" data-sitekey="${turnstileSiteKey || "TURNSTILE_SITE_KEY"}"></div>
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
