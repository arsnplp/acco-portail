import { NextResponse } from "next/server";
import { getCurrentUser, isGestionnaire } from "@/lib/auth";
import { oauthClient, oauthConfigured, GOOGLE_SCOPES, GOOGLE_SCOPES_PERSO } from "@/lib/google-oauth";

/**
 * Démarre la connexion Google.
 * - sans paramètre : compte de l'agence (Search Console, fiche Google, Gmail) — gestionnaire uniquement ;
 * - ?perso=1 : compte personnel d'un membre de l'équipe (sa boîte Gmail pour le CRM).
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  const perso = new URL(req.url).searchParams.get("perso") === "1";
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!user || user.role === "CLIENT" || (!perso && !isGestionnaire(user))) return NextResponse.redirect(new URL("/", base));
  const retour = user.role === "ADMIN" ? "/admin/parametres" : "/crm/parametres";
  if (!oauthConfigured()) return NextResponse.redirect(new URL(`${retour}?google=non-configure`, base));
  const url = oauthClient().generateAuthUrl({ access_type: "offline", prompt: "consent", scope: perso ? GOOGLE_SCOPES_PERSO : GOOGLE_SCOPES, include_granted_scopes: true, state: perso ? "perso" : "agence" });
  return NextResponse.redirect(url);
}
