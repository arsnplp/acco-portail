import { createClient } from "@supabase/supabase-js";

/** Client service_role : uniquement côté serveur (invitations, storage, admin). */
export function createSupabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
