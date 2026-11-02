import { NextResponse } from "next/server";
import { syncSearchConsoleQuotidienne } from "@/lib/recaps";

/** Secours cron : chiffres Search Console une fois par jour (00.7). Le serveur le fait déjà tout seul. */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  return NextResponse.json(await syncSearchConsoleQuotidienne());
}
