import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { recordLogin } from "@/lib/login-log";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL!; // adresse publique, même derrière nginx
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  if (searchParams.get("error")) {
    const desc = searchParams.get("error_description") ?? "";
    return NextResponse.redirect(`${origin}/connexion?erreur=${/signup|not allowed/i.test(desc) ? "compte-inconnu" : "lien-invalide"}`);
  }
  const supabase = await createSupabaseServer();
  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "magiclink" | "email" | "invite" })).error;
  }

  if (!ok) return NextResponse.redirect(`${origin}/connexion?erreur=lien-invalide`);
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await recordLogin(user.id, request.headers.get("user-agent"));
  const hasPassword = user?.user_metadata?.password_set === true;
  const target = next.startsWith("/") ? next : "/";
  if (!hasPassword && target !== "/nouveau-mot-de-passe") return NextResponse.redirect(`${origin}/nouveau-mot-de-passe?premiere=1`);
  return NextResponse.redirect(`${origin}${target}`);
}
