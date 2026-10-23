import { Lock, Star, MessageSquareText } from "lucide-react";
import { requireClientSite, monthRange } from "@/lib/sites";
import { hasModule } from "@/lib/offers";
import { prisma } from "@/lib/prisma";
import { syncReviews } from "@/lib/reviews";
import { Button } from "@/components/ui/button";
import { MoreList } from "@/components/ui/more-list";
import { Card, SectionTitle } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { Avatar } from "@/components/ui/avatar";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmtDateShort } from "@/lib/format";
import { ReplyForm } from "./reply-form";
import { refreshReviews } from "./actions";
import { isStale } from "@/lib/reviews";
import { CircleCheckIcon, MessageSquareIcon } from "lucide-react";

export const metadata = { title: "Avis" };

export default async function AvisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site } = await requireClientSite(id);
  if (!(await hasModule(site.id, "AVIS"))) return <LockedAvis />;

  // Première ouverture ou données de plus de 6 h : on synchronise à la volée.
  if (isStale(site.reviewsSyncedAt)) {
    try { await syncReviews(site.id, { notify: false }); } catch (e) { console.warn("[avis] synchro impossible :", (e as Error).message); }
  }
  const fresh = await prisma.site.findUniqueOrThrow({ where: { id: site.id }, select: { reviewAverage: true, reviewTotal: true, reviewsSyncedAt: true } });
  const { start, end } = monthRange();
  const [reviews, monthCount] = await Promise.all([
    prisma.review.findMany({ where: { siteId: site.id }, orderBy: { publishedAt: "desc" }, take: 60 }),
    prisma.review.count({ where: { siteId: site.id, publishedAt: { gte: start, lt: end } } }),
  ]);
  const unanswered = reviews.filter((r) => !r.reply);
  const answered = reviews.filter((r) => r.reply);
  const avg = fresh.reviewAverage ?? (reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null);
  const total = fresh.reviewTotal ?? reviews.length;
  const isDemo = reviews.some((r) => r.source === "DEMO");

  return (
    <div>
      <Card className="flex items-center gap-4">
        <span className="font-title text-4xl font-extrabold text-title">{avg ? avg.toFixed(1).replace(".", ",") : "–"}</span>
        <div>
          <Stars n={Math.round(avg ?? 0)} size={16} />
          <p className="mt-1 text-sm text-text">{total} avis · {monthCount} ce mois-ci</p>
        </div>
        <form action={refreshReviews.bind(null, site.id)} className="ml-auto"><SubmitButton variant="ghost" size="sm" pendingLabel="…">Actualiser</SubmitButton></form>
      </Card>
      {isDemo && <p className="mt-2 text-xs text-muted">Aperçu avec des avis d’exemple : vos vrais avis Google apparaîtront dès que Google aura validé l’accès de votre fiche.</p>}

      <SectionTitle icon={MessageSquareIcon}>À répondre {unanswered.length > 0 && <span className="text-sm font-normal text-text">({unanswered.length})</span>}</SectionTitle>
      {unanswered.length === 0 ? (
        <Empty icon={MessageSquareText} title="Vous avez répondu à tout le monde" text="Bravo, c’est ce que Google aime voir." />
      ) : (
        <MoreList title="Avis à répondre" limit={5} items={unanswered.map((r) => (
            <ReviewCard key={r.id} r={r}>
              <ReplyForm siteId={site.id} reviewId={r.id} suggestion={r.suggestedReply} />
            </ReviewCard>
          ))} />
      )}

      {answered.length > 0 && (
        <>
          <SectionTitle icon={CircleCheckIcon}>Déjà répondus</SectionTitle>
          <MoreList title="Avis déjà répondus" labels={answered.map((r) => r.authorName)} limit={5} items={answered.map((r) => (
              <ReviewCard key={r.id} r={r}>
                <div className="mt-3 rounded-sm border-l-2 border-green pl-3">
                  <p className="text-xs text-green">Votre réponse{r.repliedAt ? ` · ${fmtDateShort(r.repliedAt)}` : ""}</p>
                  <p className="mt-1 text-sm text-text-strong">{r.reply}</p>
                </div>
              </ReviewCard>
            ))} />
        </>
      )}
    </div>
  );
}

function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return <div className="flex gap-0.5 text-yellow" aria-label={`${n} sur 5`}>{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} fill={i <= n ? "currentColor" : "none"} className={i <= n ? "" : "text-border"} />)}</div>;
}

function ReviewCard({ r, children }: { r: { authorName: string; authorPhotoUrl: string | null; rating: number; text: string | null; publishedAt: Date }; children: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <Avatar initials={r.authorName[0] ?? "?"} src={r.authorPhotoUrl} size={34} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2"><p className="truncate font-semibold text-title">{r.authorName}</p><span className="shrink-0 text-xs text-muted">{fmtDateShort(r.publishedAt)}</span></div>
          <Stars n={r.rating} />
        </div>
      </div>
      <p className="mt-3 text-sm text-text-strong">{r.text ?? <span className="italic text-text">Sans commentaire</span>}</p>
      {children}
    </Card>
  );
}

async function LockedAvis() {
  const offer = await prisma.offer.findFirst({ where: { module: "AVIS", isArchived: false }, select: { slug: true } });
  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-60 blur-[6px]" aria-hidden>
        <Card className="flex items-center gap-4"><span className="font-title text-4xl font-extrabold text-title">4,8</span><div><Stars n={5} size={16} /><p className="text-sm text-text">127 avis · 6 ce mois-ci</p></div></Card>
        <div className="mt-3 grid gap-2">
          {["Super accueil, produits frais, je recommande !", "Très satisfaite, équipe à l’écoute.", "Un peu d’attente mais ça vaut le coup."].map((t, i) => (
            <Card key={i} className="py-3"><Stars n={5} /><p className="mt-2 text-sm text-text-strong">{t}</p><p className="mt-2 text-xs text-blue">Réponse proposée · Publier</p></Card>
          ))}
        </div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center shadow-2xl shadow-black/60">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-border text-yellow"><Lock size={20} /></span>
          <h2 className="mt-4 text-lg">Vos avis Google, ici</h2>
          <p className="mt-2 text-sm text-text">Recevez plus d’avis grâce à la plaquette de comptoir NFC + QR, et répondez en un tap avec une réponse déjà rédigée.</p>
          <Button href={`/offres#${offer?.slug ?? ""}`} className="mt-5 w-full">Débloquer avec la plaquette avis Google</Button>
        </Card>
      </div>
    </div>
  );
}
