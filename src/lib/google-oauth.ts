import { OAuth2Client } from "google-auth-library";
import { prisma } from "@/lib/prisma";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly", // Search Console (lecture)
  "https://www.googleapis.com/auth/business.manage", // Fiche Google : avis et réponses (étape 7)
  "https://www.googleapis.com/auth/gmail.readonly", // CRM : historique des emails échangés avec un prospect (lecture seule)
  "openid", "email",
];

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

export async function disconnectGoogle() {
  await prisma.setting.deleteMany({ where: { key: { in: ["google_refresh_token", "google_account_email"] } } });
}
