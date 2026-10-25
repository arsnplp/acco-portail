import { NextResponse } from "next/server";
import { getCurrentUser, isGestionnaire } from "@/lib/auth";
import { oauthClient, oauthConfigured, GOOGLE_SCOPES } from "@/lib/google-oauth";

/** Démarre la connexion Google (admin uniquement). */
export async function GET() {
  const user = await getCurrentUser();
  if (!isGestionnaire(user)) return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL));
  if (!oauthConfigured()) return NextResponse.redirect(new URL("/admin/parametres?google=non-configure", process.env.NEXT_PUBLIC_APP_URL));
  const url = oauthClient().generateAuthUrl({ access_type: "offline", prompt: "consent", scope: GOOGLE_SCOPES, include_granted_scopes: true });
  return NextResponse.redirect(url);
}
