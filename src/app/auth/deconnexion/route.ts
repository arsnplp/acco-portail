import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/connexion`, { status: 303 });
}
