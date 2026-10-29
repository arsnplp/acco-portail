import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { oauthConfigured, connectedGoogleEmail } from "@/lib/google-oauth";
import { listProperties } from "@/lib/google-search";
import { saveSettings, disconnectGoogleAction } from "./actions";
import { ServicesForm } from "./services-form";
import { AdminNotifForm } from "./notif-form";
import { isGestionnaire, requireAdmin } from "@/lib/auth";
import { secretsStatus, featureToggles } from "@/lib/settings";
import { NewPasswordForm } from "@/app/nouveau-mot-de-passe/form";
import { LogOut } from "lucide-react";
import { BellIcon, KeyRoundIcon, Link2Icon, LockIcon, SettingsIcon } from "lucide-react";

export const metadata = { title: "Paramètres" };

const GOOGLE_MSG: Record<string, string> = {
  ok: "Google est connecté.",
  refuse: "Connexion annulée.",
  "sans-jeton": "Google n’a pas renvoyé de jeton durable. Déconnectez l’app Acco dans votre compte Google (myaccount.google.com → Sécurité → Connexions tierces) puis réessayez.",
  erreur: "Erreur pendant la connexion, réessayez.",
  "non-configure": "Ajoutez GOOGLE_OAUTH_CLIENT_ID et GOOGLE_OAUTH_CLIENT_SECRET dans .env.",
};

export default async function ParametresPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { google } = await searchParams;
  const admin = await requireAdmin();
  const notifPrefs = await prisma.notificationPreference.findUnique({ where: { userId: admin.id } });
  const moi = (
    <>
      <SectionTitle icon={BellIcon}>Mes notifications</SectionTitle>
      <AdminNotifForm prefs={notifPrefs} gestion={isGestionnaire(admin)} />

      <SectionTitle icon={LockIcon}>Mon accès</SectionTitle>
      <div className="grid gap-3">
        <details className="rounded-card border border-border bg-surface"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-title">Changer mon mot de passe</summary><div className="border-t border-border p-4"><NewPasswordForm compact next="/admin/parametres" /></div></details>
        <form action="/auth/deconnexion" method="post"><Button variant="secondary" type="submit" className="w-full"><LogOut size={18} strokeWidth={1.75} /> Se déconnecter</Button></form>
      </div>
    </>
  );
  // Clés API, Google (Search Console, avis) et réglages de l'agence : réservés au gestionnaire (Arsène).
  if (!isGestionnaire(admin)) return <AdminPage title="Paramètres">{moi}</AdminPage>;

  const [settings, email, secrets, toggles] = await Promise.all([prisma.setting.findMany(), connectedGoogleEmail(), secretsStatus(), featureToggles()]);
  const get = (k: string) => settings.find((s) => s.key === k)?.value ?? "";
  const properties = email ? await listProperties() : [];
  const sites = email ? await prisma.site.findMany({ where: { status: "EN_LIGNE" }, select: { name: true, searchConsoleProp: true } }) : [];

  return (
    <AdminPage title="Paramètres">
      <SectionTitle icon={Link2Icon}>Google (Search Console, fiche Google et emails du CRM)</SectionTitle>
      <Card className="space-y-3">
        {google && <p className={`text-sm ${google === "ok" ? "text-green" : "text-pink"}`}>{GOOGLE_MSG[google] ?? ""}</p>}
        {email ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div><p className="font-medium text-title">Connecté avec {email}</p><p className="text-xs text-text">{properties.length} propriété{properties.length > 1 ? "s" : ""} Search Console accessible{properties.length > 1 ? "s" : ""}.</p></div>
              <form action={disconnectGoogleAction}><SubmitButton variant="ghost" size="sm" pendingLabel="…">Déconnecter</SubmitButton></form>
            </div>
            {properties.length > 0 && (
              <ul className="grid gap-1 text-xs text-text-strong">
                {properties.map((p) => {
                  const linked = sites.find((s) => s.searchConsoleProp === p);
                  return <li key={p} className="flex items-center justify-between gap-2 rounded-sm border border-border px-3 py-1.5"><code>{p}</code>{linked ? <Badge tone="green">{linked.name}</Badge> : <span className="text-muted">non lié</span>}</li>;
                })}
              </ul>
            )}
            <p className="text-xs text-muted">Pour lier un site : Sites → le site → Propriété Search Console (la liste se propose toute seule), puis « Synchroniser ».</p>
            <p className="text-xs text-muted">Emails du CRM : les mails échangés avec un prospect (envoyés et reçus depuis cette boîte Gmail) apparaissent dans l’historique de sa fiche. Si la connexion date d’avant cette fonction, déconnectez puis reconnectez Google pour accorder la lecture de Gmail.</p>
          </>
        ) : (
          <>
            <p className="text-sm text-text">Connectez le compte Google d’Acco qui a accès aux Search Console de vos clients. Les chiffres réels remplaceront les chiffres de démo.</p>
            {oauthConfigured() ? <Button href="/api/google/connect">Connecter Google</Button> : <p className="text-sm text-yellow">Renseignez GOOGLE_OAUTH_CLIENT_ID et GOOGLE_OAUTH_CLIENT_SECRET dans .env puis redémarrez.</p>}
          </>
        )}
      </Card>

      <SectionTitle icon={KeyRoundIcon}>Clés et services</SectionTitle>
      <ServicesForm secrets={secrets} toggles={toggles} googleConnected={Boolean(email)} />

      {moi}

      <SectionTitle icon={SettingsIcon}>Agence</SectionTitle>
      <form action={saveSettings} className="space-y-3 rounded-card border border-border bg-surface p-4">
        <Field label="Lien « Laisser un avis » sur la fiche Google d’Acco"><Input name="google_review_url" defaultValue={get("google_review_url")} placeholder="https://g.page/r/…/review" /></Field>
        <Field label="Récompense de parrainage"><Input name="referral_reward_label" defaultValue={get("referral_reward_label")} placeholder="1 mois d’abonnement offert" /></Field>
        <SubmitButton size="sm">Enregistrer</SubmitButton>
      </form>
    </AdminPage>
  );
}
