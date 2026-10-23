import { Gift } from "lucide-react";
import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { MoreList } from "@/components/ui/more-list";
import { Card, SectionTitle } from "@/components/ui/card";
import { BackLink } from "@/components/ui/back-link";
import { ShareLink } from "./share-link";
import { RecommendForm } from "./recommend-form";
import { fmtDateShort } from "@/lib/format";
import { REFERRAL_STEPS } from "@/lib/referrals";
import { ClipboardListIcon, ContactIcon, Link2Icon } from "lucide-react";
import { GiftIcon } from "lucide-react";

export const metadata = { title: "Recommandations" };

export default async function RecommandationsPage() {
  const { user, client } = await requireClientContext();
  const [referrals, reward] = await Promise.all([
    prisma.referral.findMany({ where: { referrerClientId: client.id }, orderBy: { createdAt: "desc" }, include: { referred: { select: { name: true } } } }),
    prisma.setting.findUnique({ where: { key: "referral_reward_label" } }),
  ]);
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/r/${client.referralCode}`;
  const firstName = user.firstName ?? client.name;

  return (
    <Page title="Recommandations" subtitle="Un commerçant de votre entourage a besoin d’un site ?">
      <BackLink fallback="/compte" label="Mon compte" className="-mt-4 mb-4" />

      <Card className="flex items-start gap-3 border-green/40">
        <Gift className="mt-0.5 shrink-0 text-green" size={20} />
        <p className="text-sm text-text-strong">Pour chaque recommandation qui signe avec Acco : <strong className="text-title">{reward?.value ?? "une récompense"}</strong>.</p>
      </Card>

      <SectionTitle icon={Link2Icon}>Votre lien à partager</SectionTitle>
      <Card><ShareLink url={url} firstName={firstName} /></Card>

      <SectionTitle icon={ContactIcon}>Ou donnez-nous un contact</SectionTitle>
      <RecommendForm />

      <SectionTitle icon={ClipboardListIcon}>Vos recommandations</SectionTitle>
      {referrals.length === 0 ? <p className="text-sm text-text">Aucune pour le moment. Votre première recommandation apparaîtra ici avec son avancement.</p> : (
        <MoreList title="Vos recommandations" limit={3} items={referrals.map((r) => {
            const idx = REFERRAL_STEPS.findIndex((s) => s.key === r.status);
            return (
              <Card key={r.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-title">{r.contactName ?? r.referred?.name ?? "Via votre lien"}</p>
                  <span className="text-xs text-muted">{fmtDateShort(r.createdAt)}</span>
                </div>
                <ol className="mt-3 grid grid-cols-4 gap-1">
                  {REFERRAL_STEPS.map((s, i) => (
                    <li key={s.key} className="flex flex-col items-center gap-1.5 text-center">
                      <span className={`h-1.5 w-full rounded-full ${i < idx ? "bg-green" : i === idx ? (i === 3 ? "bg-green" : "bg-yellow") : "bg-border"}`} />
                      <span className={`text-[10px] leading-tight ${i === idx ? "font-semibold text-title" : "text-muted"}`}>{s.label}</span>
                    </li>
                  ))}
                </ol>
                {r.status === "RECOMPENSE_VALIDEE" && <p className="mt-3 flex items-center gap-1.5 text-sm text-green"><GiftIcon size={15} strokeWidth={1.75} aria-hidden /> {r.rewardLabel ?? "Récompense validée"}</p>}
              </Card>
            );
          })} />
      )}
    </Page>
  );
}
