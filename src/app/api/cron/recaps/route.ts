import { NextResponse, type NextRequest } from "next/server";
import { runMonthlyRecaps, moisDuRecap } from "@/lib/recaps";

export const maxDuration = 300;

/**
 * Secours : l'envoi se fait déjà tout seul (boucle du serveur, le 4 à 8 h). Appel manuel possible :
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://app.acco-lab.fr/api/cron/recaps
 * Paramètres facultatifs : ?year=2026&month=9 pour rejouer un mois.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  const y = Number(req.nextUrl.searchParams.get("year")), m = Number(req.nextUrl.searchParams.get("month"));
  const target = y && m ? { year: y, month: m } : moisDuRecap();
  const out = await runMonthlyRecaps(target);
  return NextResponse.json(out);
}
