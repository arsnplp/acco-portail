import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { oauthClient } from "@/lib/google-oauth";

export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL!;
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.redirect(`${base}/`);
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${base}/admin/parametres?google=refuse`);
  try {
    const client = oauthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) return NextResponse.redirect(`${base}/admin/parametres?google=sans-jeton`);
    client.setCredentials(tokens);
    const info = await client.request<{ email?: string }>({ url: "https://www.googleapis.com/oauth2/v3/userinfo" });
    await prisma.setting.upsert({ where: { key: "google_refresh_token" }, create: { key: "google_refresh_token", value: tokens.refresh_token }, update: { value: tokens.refresh_token } });
    await prisma.setting.upsert({ where: { key: "google_account_email" }, create: { key: "google_account_email", value: info.data.email ?? "" }, update: { value: info.data.email ?? "" } });
    return NextResponse.redirect(`${base}/admin/parametres?google=ok`);
  } catch (e) {
    console.error("[google oauth]", (e as Error).message);
    return NextResponse.redirect(`${base}/admin/parametres?google=erreur`);
  }
}
