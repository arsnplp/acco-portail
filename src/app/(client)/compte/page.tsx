import { FileText, LogOut, Star, ChevronRight } from "lucide-react";
import { requireClientContext, displayName } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { MoreList } from "@/components/ui/more-list";
import { Card, SectionTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtPrice, fmtDate } from "@/lib/format";
import { CompanyForm, ProfileForm, NotificationPrefsForm } from "./forms";
import { switchClient } from "./actions";
import { EnablePush } from "@/components/push/enable-push";

export const metadata = { title: "Mon compte" };

export default async function ComptePage() {
  const { user, client, membership } = await requireClientContext();
  const isOwner = membership.role === "OWNER";
  const [subs, docCount, prefs, reviewUrl] = await Promise.all([
    prisma.subscription.findMany({ where: { clientId: client.id, status: "ACTIF" }, include: { site: { select: { name: true } } }, orderBy: { startedAt: "asc" } }),
    prisma.document.count({ where: { clientId: client.id } }),
    prisma.notificationPreference.findUnique({ where: { userId: user.id } }),
    prisma.setting.findUnique({ where: { key: "google_review_url" } }),
  ]);

  return (
    <Page title="Mon compte" subtitle={displayName(user)}>
      {user.memberships.length > 1 && (
        <>
          <SectionTitle emoji="🔀">Entreprise affichée</SectionTitle>
          <div className="grid gap-2">
            {user.memberships.map((m) => (
              <form key={m.clientId} action={switchClient.bind(null, m.clientId)}>
                <button className={`flex w-full items-center justify-between rounded-card border px-4 py-3 text-left ${m.clientId === client.id ? "border-title" : "border-border"}`}>
                  <span className="font-medium text-title">{m.client.name}</span>
                  {m.clientId === client.id && <Badge tone="green">Affichée</Badge>}
                </button>
              </form>
            ))}
          </div>
        </>
      )}

      <SectionTitle emoji="🏪">Entreprise</SectionTitle>
      <CompanyForm client={{ name: client.name, address: client.address, phone: client.phone, email: client.email }} editable={isOwner} />

      <SectionTitle emoji="📄">Documents</SectionTitle>
      <Card href="/compte/documents" className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3"><FileText size={20} strokeWidth={1.5} className="text-text" /><div><p className="font-medium text-title">Contrats, factures, devis</p><p className="text-xs text-text">{docCount} document{docCount > 1 ? "s" : ""}</p></div></div>
        <ChevronRight size={18} className="text-text" />
      </Card>

      <SectionTitle emoji="💳">Abonnements et modules</SectionTitle>
      <div className="grid gap-2">
        <MoreList title="Abonnements" limit={3} className="grid gap-2" items={subs.map((s) => (
          <Card key={s.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="font-medium text-title">{s.label}</p>
              <p className="text-xs text-text">{s.site?.name ? `${s.site.name} · ` : ""}{fmtPrice(s.priceCents)}{s.billing === "MENSUEL" ? " / mois" : ""}{s.commitmentEndsAt ? ` · engagé jusqu’au ${fmtDate(s.commitmentEndsAt)}` : ""}</p>
            </div>
            <Badge tone="green">Actif</Badge>
          </Card>
        ))} />
        {subs.length === 0 && <p className="text-sm text-text">Aucun abonnement actif.</p>}
      </div>

      <SectionTitle emoji="🤝">Recommandations</SectionTitle>
      <Card href="/compte/recommandations" className="flex items-center justify-between py-3">
        <div><p className="font-medium text-title">Recommander Acco</p><p className="text-xs text-text">Votre lien à partager, vos recommandations et leur avancement.</p></div>
        <ChevronRight size={18} className="text-text" />
      </Card>

      <SectionTitle emoji="⭐">Noter Acco</SectionTitle>
      <Card className="flex items-center justify-between gap-3 py-3">
        <p className="text-sm text-text">Un avis sur Google nous aide énormément. Merci !</p>
        <Button variant="secondary" size="sm" href={reviewUrl?.value ?? "#"}><Star size={14} /> Laisser un avis</Button>
      </Card>

      <SectionTitle emoji="👤">Vous</SectionTitle>
      <ProfileForm user={{ firstName: user.firstName, lastName: user.lastName, email: user.email }} />

      <SectionTitle emoji="🔔">Notifications</SectionTitle>
      <Card className="mb-3"><EnablePush /></Card>
      <NotificationPrefsForm prefs={prefs} />

      <div className="mt-10 grid gap-2">
        <Button variant="secondary" href="/nouveau-mot-de-passe" className="w-full">Changer mon mot de passe</Button>
        <form action="/auth/deconnexion" method="post">
          <Button variant="secondary" type="submit" className="w-full"><LogOut size={18} strokeWidth={1.75} /> Se déconnecter</Button>
        </form>
      </div>
    </Page>
  );
}
