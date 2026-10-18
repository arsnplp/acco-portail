// Génère un lien de connexion local SANS envoyer d'email (dev uniquement).
// Usage : node --env-file=.env scripts/lien-connexion.mjs arsene@acco-lab.fr
import { createClient } from "@supabase/supabase-js";
const email = process.argv[2];
if (!email) { console.error("Usage : node --env-file=.env scripts/lien-connexion.mjs <email>"); process.exit(1); }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await sb.auth.admin.generateLink({ type: "magiclink", email });
if (error) { console.error(error.message); process.exit(1); }
console.log(`${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink`);
