import { NextResponse, type NextRequest } from "next/server";
import { runReviewsSync } from "@/lib/reviews";

export const maxDuration = 300;

/** Synchronisation des avis (cron toutes les 6 h) : curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/reviews */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  return NextResponse.json(await runReviewsSync());
}
