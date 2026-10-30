import { cookies } from "next/headers";

export type Theme = "dark" | "light";
/** Mode jour / nuit choisi par l'utilisateur (cookie posé par le bouton soleil / lune), nuit par défaut. */
export async function getTheme(): Promise<Theme> {
  return (await cookies()).get("acco-theme")?.value === "light" ? "light" : "dark";
}
