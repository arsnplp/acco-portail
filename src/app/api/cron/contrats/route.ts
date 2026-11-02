import { NextResponse } from "next/server";
import { tachesContrats } from "@/lib/contrats-taches";

/** Secours cron : tâches de relance et alertes J-90 des contrats. */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  return NextResponse.json(await tachesContrats());
}
