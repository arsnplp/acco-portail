"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClientSite } from "@/lib/sites";
import { uploadFile } from "@/lib/storage";
import { after } from "next/server";
import { notifyAdmins, excerpt } from "@/lib/notify";

export async function uploadAsset(siteId: string, assetId: string, formData: FormData) {
  const { site } = await requireClientSite(siteId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  const asset = await prisma.siteAsset.findFirst({ where: { id: assetId, siteId: site.id } });
  if (!asset) return;
  const storagePath = await uploadFile("site-assets", site.id, file);
  await prisma.siteAsset.update({ where: { id: asset.id }, data: { storagePath, fileName: file.name, uploadedAt: new Date() } });
  after(() => notifyAdmins({ pref: "documents", tag: `asset-${asset.id}`, href: `/admin/sites/${site.id}`, title: `Fichier reçu · ${site.name}`, body: excerpt(file.name) }));
  revalidatePath(`/sites/${site.id}`);
}

export async function validateMockup(siteId: string) {
  const { site, user } = await requireClientSite(siteId);
  // Le client valide la V1 (étape Présentation V1) ou la V2 (étape Validation client) : le site avance d'une colonne.
  // Rien n'est validable tant que la maquette n'a pas été envoyée explicitement (10.4 : clic « Envoyer maquette »).
  if (!site.maquetteEnvoyeeAt) return;
  const suite = site.projectStep === "VALIDER_MAQUETTE" ? "MODIFIER" : site.projectStep === "VALIDER_MODIFICATION" ? "FINIR" : null;
  if (!suite) return;
  const quoi = site.projectStep === "VALIDER_MAQUETTE" ? "Maquette validée" : "Version validée";
  await prisma.$transaction([
    prisma.site.update({ where: { id: site.id }, data: { mockupValidatedAt: new Date(), projectStep: suite, etapeAt: new Date() } }),
    prisma.siteHistoryEntry.create({
      data: { siteId: site.id, kind: "INTERVENTION", title: quoi, description: `Validée par ${user.firstName ?? user.email}`, authorId: user.id, items: [] },
    }),
  ]);
  const { logActivite } = await import("@/lib/activite");
  await logActivite({ kind: "validation_client", texte: `${site.name} : ${quoi.toLowerCase()} par le client`, href: `/admin/sites/${site.id}`, clientId: site.clientId, siteId: site.id });
  revalidatePath("/admin/production");
  revalidatePath(`/sites/${site.id}`);
}

/** Le client complète une section du brief (10.3, 14.3) : la section passe « reçue », l'équipe valide ensuite. */
export async function saveBriefSectionClient(siteId: string, key: string, formData: FormData) {
  const { site, user } = await requireClientSite(siteId);
  const { BRIEF_SECTIONS, majSection } = await import("@/lib/brief");
  if (!BRIEF_SECTIONS.some((s) => s.key === key && s.client)) return;
  const { chargerBrief, lireContenu, sectionDe } = await import("@/lib/brief");
  const b = await chargerBrief(site.id);
  if (b.etat === "VALIDE" || sectionDe(lireContenu(b.contenu), key).etat === "VALIDE") return;
  await majSection(site.id, key, { texte: String(formData.get("texte") ?? "").slice(0, 8000), etat: "RECU" }, `${user.firstName ?? user.email} (client)`);
  after(() => notifyAdmins({ pref: "documents", tag: `brief-${site.id}-${key}`, href: `/admin/sites/${site.id}/brief`, title: `Brief complété · ${site.name}`, body: key }));
  revalidatePath(`/sites/${site.id}/brief`);
}

/** Retour sur la maquette (10.4, 14.3) : une demande de retouche, visible de l'équipe, seulement après « Envoyer maquette ». */
export async function demanderRetouche(siteId: string, formData: FormData) {
  const { site, user } = await requireClientSite(siteId);
  if (!site.maquetteEnvoyeeAt || site.status !== "EN_CREATION") return;
  const title = String(formData.get("title") ?? "").trim().slice(0, 140);
  const description = String(formData.get("description") ?? "").trim().slice(0, 4000);
  if (!title) return;
  const cr = await prisma.changeRequest.create({ data: { siteId: site.id, title, description: description || title, page: String(formData.get("page") ?? "").trim() || null } });
  const { logActivite } = await import("@/lib/activite");
  await logActivite({ kind: "modification", texte: `${site.name} : retour du client sur la maquette V${site.version} (${title})`, href: `/admin/sites/${site.id}`, clientId: site.clientId, siteId: site.id });
  after(() => notifyAdmins({ pref: "changes", tag: `retouche-${cr.id}`, href: `/admin/sites/${site.id}`, title: `Retour maquette · ${site.name}`, body: `${user.firstName ?? user.email} : ${excerpt(title)}` }));
  revalidatePath(`/sites/${site.id}`);
}

/** Commande d'article de blog (14.4) : titre, consignes, option de relecture avant publication. Réservé aux offres de contenu. */
export async function commanderArticle(siteId: string, formData: FormData) {
  const { site, user } = await requireClientSite(siteId);
  const titre = String(formData.get("titre") ?? "").trim().slice(0, 160);
  if (!titre) return;
  const a = await prisma.article.create({ data: { siteId: site.id, titre, consignes: String(formData.get("consignes") ?? "").trim().slice(0, 4000) || null, demandeClient: true, approbationClient: formData.get("approbation") === "on" } });
  after(() => notifyAdmins({ pref: "changes", tag: `article-${a.id}`, href: `/admin/sites/${site.id}`, title: `Article commandé · ${site.name}`, body: `${user.firstName ?? user.email} : ${excerpt(titre)}` }));
  revalidatePath(`/sites/${site.id}/blog`);
}

/** Conseils rédigés par Claude, sur clic seulement (00.6) ; sans IA, les règles restent. */
export async function personnaliserConseilsAction(siteId: string): Promise<{ error?: string }> {
  const { site, user } = await requireClientSite(siteId);
  const { personnaliserConseils } = await import("@/lib/conseils");
  const r = await personnaliserConseils(site.id, user.id);
  revalidatePath(`/sites/${site.id}/conseils`);
  return typeof r === "object" && r && "error" in r ? { error: String((r as { error?: string }).error ?? "") } : {};
}
