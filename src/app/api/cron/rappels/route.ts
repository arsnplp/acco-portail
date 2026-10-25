import { NextResponse } from "next/server";
import { sendDueRappels } from "@/lib/crm-rappels";

/** Secours si besoin d'un cron externe (le serveur vérifie déjà chaque minute tout seul). */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  return NextResponse.json(await sendDueRappels());
}
