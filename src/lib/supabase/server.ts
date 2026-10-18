import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Client Supabase côté serveur (Server Components, Server Actions, Route Handlers). */
export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Appelé depuis un Server Component : les cookies sont rafraîchis par le proxy.
          }
        },
      },
    },
  );
}
