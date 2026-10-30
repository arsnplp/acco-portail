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
import { isGestionnaire, requireAdmin } from "@/lib/auth";
import { secretsStatus, featureToggles } from "@/lib/settings";
import { KeyRoundIcon, Link2Icon, SettingsIcon } from "lucide-react";
import { GOOGLE_MSG, MesParametres } from "./moi";

export const metadata = { title: "Paramètres" };

export default async function ParametresPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { google } = await searchParams;
  const admin = await requireAdmin();
  const moi = <MesParametres user={admin} google={google} next="/admin/parametres" />;
  // Clés API, Google de l'agence (Search Console, avis) et réglages de l'agence : réservés au gestionnaire (Arsène).
  // Les autres admins et les commerciaux ont leurs paramètres personnels (compte Google à eux, notifications, accès).
  if (!isGestionnaire(admin)) return <AdminPage title="Paramètres">{moi}</AdminPage>;

  const [settings, email, secrets, toggles] = await Promise.all([prisma.setting.findMany(), connectedGoogleEmail(), secretsStatus(), featureToggles()]);
  const get = (k: string) => settings.find((s) => s.key === k)?.value ?? "";
  const properties = email ? await listProperties() : [];
  const sites = email ? await prisma.site.findMany({ where: { status: "EN_LIGNE" }, select: { name: true, searchConsoleProp: true } }) : [];

  return (
    <AdminPage title="Paramètres">
      <SectionTitle icon={Link2Icon}>Google de l’agence (Search Console, fiche Google et emails du CRM)</SectionTitle>
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
            <p className="text-xs text-muted">Emails du CRM : les mails échangés avec un prospect depuis cette boîte apparaissent dans l’historique de sa fiche. Si la connexion date d’avant cette fonction, déconnectez puis reconnectez Google pour accorder la lecture de Gmail. Chaque membre de l’équipe peut aussi connecter son propre compte (section « Mon compte Google » plus bas).</p>
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
