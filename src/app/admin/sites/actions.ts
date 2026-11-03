"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { isGestionnaire, requireTeam, requireGestionnaire } from "@/lib/auth";
import type { ProjectStep, SiteStatus } from "@prisma/client";
import { maybeCreateReviewPrompt } from "@/lib/review-prompt";
import { logActivite } from "@/lib/activite";
import { stepLabel } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { requireSiteAcces } from "@/lib/perimetre";
import { changerDates, demanderGoLive, demanderValidationMaquette, envoyerMaquette, gardeFous, tachesRecurrentesLivraison } from "@/lib/production";
import { uploadFile } from "@/lib/storage";
import { teamName } from "@/lib/crm";

export type ActionState = { error?: string; ok?: boolean };

export async function updateSite(siteId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireTeam();
  await requireSiteAcces(admin, siteId);
  const d = Object.fromEntries(formData) as Record<string, string>;
  const before = await prisma.site.findUnique({ where: { id: siteId }, include: { developpeur: { select: { firstName: true, email: true } } } });
  if (!before) return { error: "Site introuvable" };

  const status = d.status as SiteStatus;
  const projectStep = d.projectStep as ProjectStep;
  const goesLive = before.status !== "EN_LIGNE" && status === "EN_LIGNE";
  const url = d.url?.trim() || null;
  // Garde-fous (10.6, 10.7) : la mise en ligne passe par l'autorisation d'Arsène ; une étape ne s'avance pas sans ses prérequis.
  if (goesLive) { const refus = await gardeFous(siteId, "LIVRE", admin); if (refus) return { error: refus }; }
  else if (projectStep !== before.projectStep) { const refus = await gardeFous(siteId, projectStep, admin); if (refus) return { error: refus }; }
  // Dates de production : réservées (droit dates_production) ; les autres gardent l'existant.
  const datesOk = can(admin, "dates_production");
  const date = (v?: string) => (v ? new Date(`${v}T12:00:00`) : null);
  const dates = datesOk ? { deadlineV1: date(d.deadlineV1), deadlineV2: date(d.deadlineV2), deadlineLivraison: date(d.deadlineLivraison) } : { deadlineV1: before.deadlineV1, deadlineV2: before.deadlineV2, deadlineLivraison: before.deadlineLivraison };

  // Propriété Search Console : saisie, sinon devinée depuis le domaine du site (sc-domain:exemple.fr) si Google y a accès.
  // Search Console et fiche Google : réglés par le gestionnaire seulement ; pour les autres, on garde l'existant.
  const gestion = isGestionnaire(admin);
  let searchConsoleProp = gestion ? d.searchConsoleProp?.trim() || null : before.searchConsoleProp;
  if (!searchConsoleProp && url && status === "EN_LIGNE") {
    const { listProperties } = await import("@/lib/google-search");
    const host = new URL(url).hostname.replace(/^www\./, "");
    const props = await listProperties();
    searchConsoleProp = props.find((p) => p === `sc-domain:${host}`) ?? props.find((p) => p.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") === host) ?? null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.site.update({
      where: { id: siteId },
      data: {
        name: d.name.trim(),
        url,
        previewUrl: d.previewUrl?.trim() || null,
        screenshotUrl: d.screenshotUrl?.trim() || null,
        status,
        projectStep: goesLive ? "A_LIVRER" : projectStep,
        etapeAt: projectStep !== before.projectStep ? new Date() : before.etapeAt,
        developpeurId: d.developpeurId || null,
        launchedAt: goesLive ? new Date() : before.launchedAt,
        goLiveAutoriseAt: goesLive && !before.goLiveAutoriseAt ? new Date() : before.goLiveAutoriseAt,
        goLiveAutoriseParId: goesLive && !before.goLiveAutoriseAt ? admin.id : before.goLiveAutoriseParId,
        searchConsoleProp,
        googleLocationId: gestion ? d.googleLocationId?.trim() || null : before.googleLocationId,
        repoUrl: d.repoUrl?.trim() || null,
        repoBranch: d.repoBranch?.trim() || null,
        repoRoot: d.repoRoot?.trim().replace(/^\/+|\/+$/g, "") || null,
      },
    });
    if (goesLive) {
      await tx.siteHistoryEntry.create({ data: { siteId, kind: "MISE_EN_LIGNE", title: "Mise en ligne", authorId: admin.id, items: [] } });
      await tx.notification.create({
        data: { clientId: before.clientId, siteId, kind: "SITE_EN_LIGNE", title: "Votre site est en ligne", body: before.name, href: `/sites/${siteId}` },
      });
    }
  });
  if (datesOk) await changerDates(siteId, admin.id, dates, d.motifDates?.trim() || null);
  if ((d.developpeurId || null) !== before.developpeurId) {
    const nouveau = d.developpeurId ? await prisma.user.findUnique({ where: { id: d.developpeurId }, select: { firstName: true, email: true } }) : null;
    await logActivite({ kind: "site_dev", texte: `${before.name} : développeur ${before.developpeur ? teamName(before.developpeur) : "personne"} → ${nouveau ? teamName(nouveau) : "personne"}`, href: `/admin/sites/${siteId}`, userId: admin.id, clientId: before.clientId, siteId });
  }
  if (goesLive) await maybeCreateReviewPrompt(before.clientId, "SITE_EN_LIGNE");
  if (goesLive) { await logActivite({ kind: "site_statut", texte: `${before.name} est en ligne`, href: `/admin/sites/${siteId}`, userId: admin.id, clientId: before.clientId, siteId }); await tachesRecurrentesLivraison(siteId, admin.id); }
  else if (projectStep !== before.projectStep) {
    await logActivite({ kind: "site_etape", texte: `${before.name} passe à « ${stepLabel(projectStep)} »`, href: `/admin/sites/${siteId}`, userId: admin.id, clientId: before.clientId, siteId });
    if (projectStep === "VALIDER_MAQUETTE") await demanderValidationMaquette(siteId, admin.id);
  }
  revalidatePath("/admin/production");
  // Échéances ou développeur modifiés : agendas Google du commercial du client et du développeur.
  after(async () => {
    const [{ syncAgendaUsers }, client] = await Promise.all([import("@/lib/agenda"), prisma.client.findUnique({ where: { id: before.clientId }, select: { commercialId: true } })]);
    await syncAgendaUsers([client?.commercialId, before.developpeurId, d.developpeurId || null]);
  });
  // Première liaison à une propriété (ou propriété changée) : on récupère 12 mois et on prépare le récap du mois dernier.
  if (status === "EN_LIGNE" && searchConsoleProp && searchConsoleProp !== before.searchConsoleProp) {
    const { syncSiteMonths, activerRecapAuto } = await import("@/lib/recaps");
    const res = await syncSiteMonths(siteId, 12);
    if (res.real && res.months > 0) await activerRecapAuto(siteId);
  }

  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}`, "layout");
  return { ok: true };
}

export async function addHistoryEntry(siteId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireTeam();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Titre requis" };
  const items = String(formData.get("items") ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const kind = formData.get("kind") === "CREATION" ? "CREATION" : "INTERVENTION";
  const happenedAt = formData.get("happenedAt") ? new Date(String(formData.get("happenedAt"))) : new Date();
  await prisma.siteHistoryEntry.create({
    data: { siteId, kind, title, description: String(formData.get("description") ?? "").trim() || null, items, happenedAt, authorId: admin.id },
  });
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { name: true, clientId: true } });
  await logActivite({ kind: "intervention", texte: `${site?.name ?? "Site"} : ${title}`, href: `/admin/sites/${siteId}`, userId: admin.id, clientId: site?.clientId, siteId });
  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}`);
  return { ok: true };
}

export async function addAssetRequest(siteId: string, formData: FormData) {
  await requireTeam();
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;
  const kind = (["LOGO", "TEXTE", "PHOTO", "AUTRE"].includes(String(formData.get("kind"))) ? formData.get("kind") : "AUTRE") as "LOGO" | "TEXTE" | "PHOTO" | "AUTRE";
  await prisma.siteAsset.create({ data: { siteId, label, kind } });
  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}`);
}

export type SyncState = { error?: string; ok?: string };

export async function syncSearchConsole(siteId: string, _prev: SyncState, formData: FormData): Promise<SyncState> {
  await requireGestionnaire();
  const months = Math.min(24, Math.max(1, parseInt(String(formData.get("months") ?? "12"), 10) || 12));
  const { syncSiteMonths, activerRecapAuto } = await import("@/lib/recaps");
  const res = await syncSiteMonths(siteId, months);
  let recap = "";
  if (res.real && res.months > 0) recap = await activerRecapAuto(siteId);
  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}/resultats`);
  if (res.error) return { error: `Google a refusé : ${res.error}` };
  if (!res.real) return { error: "Chiffres de démo : Google n’est pas connecté ou la propriété Search Console du site est vide." };
  if (res.months === 0) return { error: "Google n’a renvoyé aucun mois : la propriété est-elle la bonne ?" };
  return { ok: `${res.months} mois récupérés depuis Google. Récap mensuel automatique activé. ${recap}` };
}

export async function syncReviewsAction(siteId: string) {
  await requireGestionnaire();
  const { syncReviews } = await import("@/lib/reviews");
  await syncReviews(siteId, { notify: true });
  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}/avis`);
}

export async function checkSiteNow(siteId: string) {
  await requireTeam();
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site?.url) return;
  const { checkSite } = await import("@/lib/monitor");
  await checkSite({ id: site.id, name: site.name, url: site.url });
  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath("/admin/sites");
  revalidatePath(`/sites/${siteId}`, "layout");
}

/** Kanban Production : déplacer un site dans une autre colonne, sous garde-fous (renvoie le motif du refus). */
export async function moveSiteEtape(siteId: string, etape: ProjectStep): Promise<{ error?: string }> {
  const me = await requireTeam();
  await requireSiteAcces(me, siteId);
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { name: true, clientId: true, projectStep: true, version: true } });
  if (!site || site.projectStep === etape) return {};
  const refus = await gardeFous(siteId, etape, me);
  if (refus) return { error: refus };
  const nouvelleVersion = site.projectStep === "MODIFIER" && etape === "VALIDER_MODIFICATION";
  await prisma.site.update({ where: { id: siteId }, data: { projectStep: etape, etapeAt: new Date(), ...(nouvelleVersion && { version: site.version + 1 }) } });
  await logActivite({ kind: "site_etape", texte: `${site.name} passe à « ${stepLabel(etape)} »${nouvelleVersion ? ` (V${site.version + 1})` : ""}`, href: `/admin/sites/${siteId}`, userId: me.id, clientId: site.clientId, siteId });
  if (etape === "VALIDER_MAQUETTE") await demanderValidationMaquette(siteId, me.id);
  if (nouvelleVersion) { const { creerTache } = await import("@/lib/taches-client"); await creerTache({ clientId: site.clientId, siteId, type: "RDV_A_PLANIFIER", titre: `Présenter la V${site.version + 1} de ${site.name} au client`, source: "maquette", createdById: me.id, notifier: true }); }
  revalidatePath("/admin/production");
  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}`, "layout");
  return {};
}

/** Demande (ou redemande) la validation interne de la maquette : Bilel et Arsène. */
export async function demanderValidationMaquetteAction(siteId: string) {
  const me = await requireTeam();
  await requireSiteAcces(me, siteId);
  await demanderValidationMaquette(siteId, me.id);
  revalidatePath(`/admin/sites/${siteId}`); revalidatePath("/admin");
}
/** « Envoyer maquette » (10.4) : clic explicite d'un membre habilité, après le rendez-vous. */
export async function envoyerMaquetteAction(siteId: string): Promise<ActionState> {
  const me = await requireTeam();
  await requireSiteAcces(me, siteId);
  if (me.role === "EXPERT" || me.role === "SPECIALISTE") return { error: "Réservé à l’équipe interne (section 13)." };
  const r = await envoyerMaquette(siteId, me.id);
  revalidatePath(`/admin/sites/${siteId}`); revalidatePath(`/sites/${siteId}`, "layout"); revalidatePath("/admin/production");
  return "error" in r ? { error: r.error } : { ok: true };
}
/** Checklist de mise en ligne puis demande d'autorisation à Arsène (10.6). */
export async function demanderGoLiveAction(siteId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireTeam();
  await requireSiteAcces(me, siteId);
  const coches = fd.getAll("check").map(String);
  const r = await demanderGoLive(siteId, me.id, coches);
  revalidatePath(`/admin/sites/${siteId}`); revalidatePath("/admin");
  return "error" in r ? { error: r.error } : { ok: true };
}
/** Document de réception de livraison signé par le client (10.6), archivé avec le site. */
export async function deposerReceptionAction(siteId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireTeam();
  await requireSiteAcces(me, siteId);
  const file = fd.get("reception");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez le document signé (PDF ou image)." };
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { name: true, clientId: true, version: true } });
  if (!site) return { error: "Site introuvable." };
  let path: string;
  try { path = await uploadFile("documents", `receptions/${siteId}`, file); } catch (e) { return { error: (e as Error).message }; }
  const signeeAt = fd.get("date") ? new Date(`${fd.get("date")}T12:00:00`) : new Date();
  await prisma.$transaction([
    prisma.site.update({ where: { id: siteId }, data: { receptionPath: path, receptionSigneeAt: signeeAt } }),
    prisma.document.create({ data: { clientId: site.clientId, siteId, kind: "AUTRE", title: `Réception de livraison · ${site.name} (V${site.version})`, storagePath: path, fileName: file.name, sizeBytes: file.size } }),
  ]);
  await logActivite({ kind: "intervention", texte: `${site.name} : réception de livraison signée`, href: `/admin/sites/${siteId}`, userId: me.id, clientId: site.clientId, siteId });
  revalidatePath(`/admin/sites/${siteId}`);
  return { ok: true };
}

// ─── Blogs ───────────────────────────────────────────────────
export async function addArticle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireTeam();
  const siteId = String(formData.get("siteId") ?? "");
  const titre = String(formData.get("titre") ?? "").trim();
  if (!siteId || !titre) return { error: "Choisissez un site et donnez un titre." };
  const statut = (["A_REDIGER", "A_PUBLIER", "PUBLIE"].includes(String(formData.get("statut"))) ? String(formData.get("statut")) : "A_REDIGER") as "A_REDIGER" | "A_PUBLIER" | "PUBLIE";
  const url = String(formData.get("url") ?? "").trim() || null;
  await prisma.article.create({ data: { siteId, titre, url, statut, auteurId: me.id, publieAt: statut === "PUBLIE" ? new Date() : null } });
  revalidatePath(`/admin/sites/${siteId}`);
  return { ok: true };
}

export async function setArticleStatut(id: string, statut: "A_REDIGER" | "A_PUBLIER" | "PUBLIE") {
  const me = await requireTeam();
  const a = await prisma.article.update({ where: { id }, data: { statut, publieAt: statut === "PUBLIE" ? new Date() : null }, include: { site: { select: { name: true, clientId: true } } } });
  if (statut === "PUBLIE") await logActivite({ kind: "article", texte: `Article publié sur ${a.site.name} : ${a.titre}`, href: `/admin/sites/${a.siteId}`, userId: me.id, clientId: a.site.clientId, siteId: a.siteId });
  revalidatePath(`/admin/sites/${a.siteId}`);
}

export async function deleteArticle(id: string) {
  await requireTeam();
  const a = await prisma.article.delete({ where: { id } });
  revalidatePath(`/admin/sites/${a.siteId}`);
}

/** Kanban Production, zone « Livré » : le site passe en ligne (historique, notification au client, demande d'avis, tâches récurrentes) et sort du tableau. Go-live autorisé par Arsène requis. */
export async function livrerSite(siteId: string): Promise<{ error?: string }> {
  const me = await requireTeam();
  await requireSiteAcces(me, siteId);
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site || site.status === "EN_LIGNE") return {};
  const refus = await gardeFous(siteId, "LIVRE", me);
  if (refus) return { error: refus };
  await prisma.$transaction(async (tx) => {
    await tx.site.update({ where: { id: siteId }, data: { status: "EN_LIGNE", projectStep: "A_LIVRER", etapeAt: new Date(), launchedAt: new Date(), ...(!site.goLiveAutoriseAt && { goLiveAutoriseAt: new Date(), goLiveAutoriseParId: me.id }) } });
    await tx.siteHistoryEntry.create({ data: { siteId, kind: "MISE_EN_LIGNE", title: "Mise en ligne", authorId: me.id, items: [] } });
    await tx.notification.create({ data: { clientId: site.clientId, siteId, kind: "SITE_EN_LIGNE", title: "Votre site est en ligne", body: site.name, href: `/sites/${siteId}` } });
  });
  await maybeCreateReviewPrompt(site.clientId, "SITE_EN_LIGNE");
  await logActivite({ kind: "site_statut", texte: `${site.name} livré : en ligne`, href: `/admin/sites/${siteId}`, userId: me.id, clientId: site.clientId, siteId });
  await tachesRecurrentesLivraison(siteId, me.id);
  revalidatePath("/admin/production");
  revalidatePath(`/admin/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}`, "layout");
  return {};
}
