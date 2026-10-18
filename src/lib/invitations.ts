import { prisma } from "@/lib/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, layout, appUrl } from "@/lib/email";

/** Crée (ou retrouve) le compte Auth sans envoyer d'email Supabase. */
export async function ensureAuthUser(email: string, meta: Record<string, string | undefined>) {
  const sb = createSupabaseAdmin();
  const { data: created, error } = await sb.auth.admin.createUser({ email, email_confirm: true, user_metadata: meta });
  if (!error) return created.user.id;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;
  const { data } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const u = data?.users.find((x) => x.email?.toLowerCase() === email);
  if (!u) throw new Error(error.message);
  return u.id;
}

/**
 * Envoie l'email d'invitation avec un lien de connexion direct (valable 1 h)
 * et le lien de secours vers la page de connexion.
 */
export async function sendInvitationEmail(opts: { email: string; firstName?: string | null; clientName: string; invitedBy?: string | null; clientId: string; inviterId?: string | null }) {
  const sb = createSupabaseAdmin();
  const { data } = await sb.auth.admin.generateLink({ type: "magiclink", email: opts.email });
  const direct = data?.properties?.hashed_token ? appUrl(`/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink`) : appUrl("/connexion");

  await prisma.invitation.create({
    data: { clientId: opts.clientId, email: opts.email, invitedBy: opts.inviterId ?? null, expiresAt: new Date(Date.now() + 7 * 86400_000) },
  });

  const who = opts.invitedBy ? `${opts.invitedBy} vous donne accès` : "L’équipe Acco vous donne accès";
  const html = layout(
    `Bienvenue${opts.firstName ? ` ${opts.firstName}` : ""} 👋`,
    `<p>${who} à l’espace client Acco de <strong>${opts.clientName}</strong>.</p>
     <p>Vous y verrez votre site, les demandes de vos clients, vos résultats Google et vous pourrez nous demander des modifications en deux taps.</p>
     <p style="font-size:13px;color:#71717a">Le bouton ci-dessous vous connecte directement pendant 1 heure. Ensuite, allez sur <a href="${appUrl("/connexion")}">${appUrl("/connexion")}</a> et entrez votre email : vous recevrez un nouveau lien.</p>`,
    { label: "Ouvrir mon espace", href: direct },
  );
  return sendEmail({ to: opts.email, subject: `Votre espace client Acco — ${opts.clientName}`, html });
}
