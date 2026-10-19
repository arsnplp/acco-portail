import { NextResponse, type NextRequest } from "next/server";
import { runMonitoring } from "@/lib/monitor";

export const maxDuration = 120;

// Toutes les 5 minutes (cron : */5 * * * *) : curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/monitor
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  return NextResponse.json(await runMonitoring());
}
