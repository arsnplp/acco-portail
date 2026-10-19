import Link from "next/link";
import { Globe, Inbox, Star, Gift, Tag } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { MoreList } from "@/components/ui/more-list";
import { Card, SectionTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Badge, Dot } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { timeAgo, fmtPrice, fmtDateShort, addDays, weekIndex } from "@/lib/format";
import { EnablePush } from "@/components/push/enable-push";
import { pendingReviewPrompt } from "@/lib/review-prompt";
import { activePromo } from "@/lib/offers";
import { answerReviewPrompt } from "./actions";
import type { NotificationKind } from "@prisma/client";

const KIND_EMOJI: Record<NotificationKind, string> = {
  DEMANDE_CONTACT: "📬", NOUVEL_AVIS: "⭐", MODIFICATION_TERMINEE: "✅", RECAP_MENSUEL: "📈", MESSAGE_EQUIPE: "💬",
  SITE_EN_LIGNE: "🎉", COMMANDE_VALIDEE: "🧩", RECOMPENSE_PARRAINAGE: "🎁", ALERTE_SITE: "⚠️", DOCUMENT_DISPONIBLE: "📄", DOCUMENT_DEMANDE: "📤",
};

export default async function AccueilPage() {
  const { user, client } = await requireClientContext();
  const [sites, notifications, prompt, reviewUrl, offers, subs, recentReferral] = await Promise.all([
    prisma.site.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "asc" } }),
    prisma.notification.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" }, take: 30, include: { site: { select: { name: true } } } }),
    pendingReviewPrompt(client.id),
    prisma.setting.findUnique({ where: { key: "google_review_url" } }),
    prisma.offer.findMany({ where: { isArchived: false }, include: { promotions: true } }),
    prisma.subscription.findMany({ where: { clientId: client.id, status: "ACTIF" }, select: { offerId: true, module: true } }),
    prisma.referral.findFirst({ where: { referrerClientId: client.id, createdAt: { gte: addDays(-90) } } }),
  ]);
  const unreadIds = notifications.filter((n) => !n.readAt).map((n) => n.id);
  if (unreadIds.length) await prisma.notification.updateMany({ where: { id: { in: unreadIds } }, data: { readAt: new Date() } });

  // Une seule sollicitation : avis sur Acco (après un moment positif) > promo en cours > parrainage, en alternant promo / parrainage une semaine sur deux.
  const promo = offers.map((o) => ({ o, p: activePromo(o) })).filter(({ o, p }) => p && !subs.some((s) => s.offerId === o.id || (o.module !== "NONE" && s.module === o.module)))[0] ?? null;
  const week = weekIndex();
  const showReferral = !recentReferral && (!promo || week % 2 === 1);
  const hour = new Date().getHours();

  return (
    <Page title={`${hour < 18 ? "Bonjour" : "Bonsoir"} ${user.firstName ?? ""}`.trim()} subtitle={client.name}>
      <EnablePush compact />

      {prompt && reviewUrl?.value ? (
        <Card className="mb-6 border-yellow/50">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-yellow"><Star size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-title">Content·e de votre site ?</p>
              <p className="mt-1 text-sm text-text">Un avis sur notre fiche Google nous aide énormément. Ça prend une minute, merci !</p>
              <div className="mt-3 flex gap-2">
                <form action={answerReviewPrompt.bind(null, prompt.id, "click")}><SubmitButton size="sm" pendingLabel="…"><Star size={14} /> Laisser un avis</SubmitButton></form>
                <form action={answerReviewPrompt.bind(null, prompt.id, "later")}><SubmitButton size="sm" variant="ghost" pendingLabel="…">Plus tard</SubmitButton></form>
              </div>
            </div>
          </div>
        </Card>
      ) : showReferral ? (
        <Card href="/compte/recommandations" className="mb-6 flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-green"><Gift size={18} /></span>
          <div className="min-w-0"><p className="font-semibold text-title">Un commerçant autour de vous cherche un site ?</p><p className="text-sm text-text">Recommandez Acco et recevez une récompense à la signature.</p></div>
        </Card>
      ) : promo ? (
        <Card href={`/offres#${promo.o.slug}`} className="mb-6 flex items-center gap-3 border-yellow/50">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-yellow"><Tag size={18} /></span>
          <div className="min-w-0">
            <p className="font-semibold text-title">{promo.o.name} : {promo.p!.promo.label.toLowerCase()}</p>
            <p className="text-sm text-text"><span className="line-through">{fmtPrice(promo.o.priceCents)}</span> {fmtPrice(promo.p!.price)}{promo.o.billing === "MENSUEL" ? " / mois" : ""} jusqu’au {fmtDateShort(promo.p!.promo.endsAt)}</p>
          </div>
        </Card>
      ) : null}

      <SectionTitle emoji="🌐">Vos sites</SectionTitle>
      <div className="grid gap-3">
        {sites.map((s) => (
          <Card key={s.id} href={`/sites/${s.id}`} className="flex items-center justify-between">
            <div><p className="font-semibold text-title">{s.name}</p><p className="text-sm text-text">{s.url ?? "En préparation"}</p></div>
            {s.status === "EN_LIGNE" ? <Badge tone="green">En ligne</Badge> : <Badge tone="yellow">En création</Badge>}
          </Card>
        ))}
        {sites.length === 0 && <Empty icon={Globe} title="Aucun site pour le moment" />}
      </div>

      <SectionTitle emoji="🔔">Quoi de neuf</SectionTitle>
      {notifications.length === 0 ? (
        <Empty icon={Inbox} title="Rien de nouveau" text="Les demandes de clients, avis, modifications terminées et récaps apparaîtront ici." />
      ) : (
        <MoreList title="Quoi de neuf" limit={5} items={notifications.map((n) => (
            <Card key={n.id} href={n.href ?? undefined} className="py-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-lg leading-none" aria-hidden>{KIND_EMOJI[n.kind]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-title">{n.title}</p>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">{unreadIds.includes(n.id) && <Dot tone="blue" />}{timeAgo(n.createdAt)}</span>
                  </div>
                  {n.body && <p className="mt-0.5 line-clamp-2 text-sm text-text">{n.body}</p>}
                  {n.site && <p className="mt-1.5 text-xs text-muted">{n.site.name}</p>}
                </div>
              </div>
            </Card>
          ))} />
      )}
      <p className="mt-6 text-center text-xs text-muted"><Link href="/compte/recommandations" className="underline-offset-2 hover:underline">Recommander Acco</Link> · <Link href="/offres" className="underline-offset-2 hover:underline">Voir les offres</Link></p>
    </Page>
  );
}
