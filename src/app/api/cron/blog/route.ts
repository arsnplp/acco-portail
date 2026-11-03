import { NextResponse } from "next/server";
import { alertesBlog, automatiserBlogs, publierBlogsDuLundi, suivrePublications } from "@/lib/blog";

/** Secours cron : automatisation des blogs et alertes du lundi. */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "non autorisé" }, { status: 401 });
  return NextResponse.json({ auto: await automatiserBlogs(), publication: await publierBlogsDuLundi(), suivi: await suivrePublications(), alertes: await alertesBlog() });
}
