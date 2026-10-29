import { NextResponse } from "next/server";
import { syncAircall } from "@/lib/aircall";

/** Secours si besoin d'un cron externe (le serveur synchronise déjà Aircall toutes les 5 minutes tout seul). */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  return NextResponse.json(await syncAircall());
}
