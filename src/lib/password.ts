import { z } from "zod";

/** Règles de mot de passe : 8 caractères minimum, au moins une lettre et un chiffre. */
export const passwordSchema = z
  .string()
  .min(8, "8 caractères minimum.")
  .max(72, "72 caractères maximum.")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Mélangez des lettres et au moins un chiffre.");
