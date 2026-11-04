import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  const res = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/connexion`, { status: 303 });
  res.cookies.set("acco_pipeline_c", "", { path: "/", maxAge: 0 });
  return res;
}
