import { prisma } from "@/lib/prisma";
import { SectionTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { NewPasswordForm } from "@/app/nouveau-mot-de-passe/form";
import { oauthConfigured } from "@/lib/google-oauth";
import { isGestionnaire } from "@/lib/roles";
import type { CurrentUser } from "@/lib/auth";
import { BellIcon, LockIcon, LogOut, MailIcon } from "lucide-react";
import { AdminNotifForm } from "./notif-form";
import { disconnectMyGoogleAction } from "./actions";

export const GOOGLE_MSG: Record<string, string> = {
  ok: "Google est connecté.",
  refuse: "Connexion annulée.",
  "sans-jeton": "Google n’a pas renvoyé de jeton durable. Déconnectez l’app Acco dans votre compte Google (myaccount.google.com → Sécurité → Connexions tierces) puis réessayez.",
  erreur: "Erreur pendant la connexion, réessayez.",
  "non-configure": "Ajoutez GOOGLE_OAUTH_CLIENT_ID et GOOGLE_OAUTH_CLIENT_SECRET dans .env.",
};

/** Paramètres personnels de chaque membre de l'équipe : son compte Google (emails du CRM), ses notifications, son accès. */
export async function MesParametres({ user, google, next }: { user: CurrentUser; google?: string; next: string }) {
  const [prefs, me] = await Promise.all([
    prisma.notificationPreference.findUnique({ where: { userId: user.id } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { googleEmail: true, googleRefreshToken: true } }),
  ]);
  const connecte = !!me?.googleRefreshToken;
  return (
    <>
      <SectionTitle icon={MailIcon}>Mon compte Google (emails du CRM)</SectionTitle>
      <div className="space-y-3 rounded-card border border-border bg-surface p-4">
        {google && <p className={`text-sm ${google === "ok" ? "text-green" : "text-pink"}`}>{GOOGLE_MSG[google] ?? ""}</p>}
        {connecte ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-title">Connecté avec {me?.googleEmail}</p>
              <p className="text-xs text-text">Les mails que vous échangez avec un prospect (envoyés et reçus) apparaissent dans l’historique de sa fiche. Lecture seule, rien n’est envoyé depuis l’app.</p>
            </div>
            <form action={disconnectMyGoogleAction}><SubmitButton variant="ghost" size="sm" pendingLabel="…">Déconnecter</SubmitButton></form>
          </div>
        ) : (
          <>
            <p className="text-sm text-text">Connectez votre propre compte Google : les mails que vous échangez avec un prospect (envoyés et reçus) apparaîtront dans l’historique de sa fiche. Lecture seule, chacun son compte.</p>
            {oauthConfigured() ? <Button href="/api/google/connect?perso=1">Connecter mon compte Google</Button> : <p className="text-sm text-yellow">Connexion Google non configurée sur le serveur (GOOGLE_OAUTH_CLIENT_ID / SECRET).</p>}
          </>
        )}
      </div>

      <SectionTitle icon={BellIcon}>Mes notifications</SectionTitle>
      <AdminNotifForm prefs={prefs} gestion={isGestionnaire(user)} />

      <SectionTitle icon={LockIcon}>Mon accès</SectionTitle>
      <div className="grid gap-3">
        <details className="rounded-card border border-border bg-surface"><summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-title">Changer mon mot de passe</summary><div className="border-t border-border p-4"><NewPasswordForm compact next={next} /></div></details>
        <form action="/auth/deconnexion" method="post"><Button variant="secondary" type="submit" className="w-full"><LogOut size={18} strokeWidth={1.75} /> Se déconnecter</Button></form>
      </div>
    </>
  );
}
