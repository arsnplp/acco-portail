import { NextResponse } from "next/server";
import { syncStripe } from "@/lib/stripe";

/** Secours si besoin d'un cron externe (le serveur synchronise déjà Stripe toutes les 6 heures tout seul). */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  return NextResponse.json(await syncStripe());
}
