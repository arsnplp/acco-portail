import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly", // Search Console (lecture)
  "https://www.googleapis.com/auth/business.manage", // Fiche Google : avis et réponses (étape 7)
  "https://www.googleapis.com/auth/gmail.readonly", // CRM : historique des emails échangés avec un prospect (lecture seule)
  "openid", "email",
];

/** Compte Google personnel d'un membre de l'équipe : seulement sa boîte Gmail (lecture) pour le CRM. */
export const GOOGLE_SCOPES_PERSO = ["https://www.googleapis.com/auth/gmail.readonly", "openid", "email"];

export const oauthConfigured = () => Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);

export function oauthClient() {
  return new OAuth2Client({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`,
  });
}

/** Client Google autorisé avec le compte Acco connecté dans l'admin (jeton stocké en base). */
export async function connectedGoogleClient() {
  if (!oauthConfigured()) return null;
  const token = await prisma.setting.findUnique({ where: { key: "google_refresh_token" } });
  if (!token) return null;
  const client = oauthClient();
  client.setCredentials({ refresh_token: token.value });
  return client;
}

export async function connectedGoogleEmail() {
  return (await prisma.setting.findUnique({ where: { key: "google_account_email" } }))?.value ?? null;
}

/** Client Google d'un membre de l'équipe (son propre compte), ou null s'il n'a rien connecté. */
export async function userGoogleClient(userId: string) {
  if (!oauthConfigured()) return null;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { googleRefreshToken: true } });
  if (!u?.googleRefreshToken) return null;
  const client = oauthClient();
  client.setCredentials({ refresh_token: u.googleRefreshToken });
  return client;
}

export async function disconnectUserGoogle(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { googleRefreshToken: null, googleEmail: null } });
}

export async function disconnectGoogle() {
  await prisma.setting.deleteMany({ where: { key: { in: ["google_refresh_token", "google_account_email"] } } });
}
