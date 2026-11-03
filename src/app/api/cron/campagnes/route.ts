import { NextResponse } from "next/server";
import { traiterCampagnes } from "@/lib/campagnes";

/** Secours cron (campagnes) : le serveur le fait déjà tout seul par ticker. */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  return NextResponse.json(await traiterCampagnes());
}
