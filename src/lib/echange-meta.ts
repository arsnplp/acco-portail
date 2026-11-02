/** Formes de `Echange.meta` (Aircall, Gmail) et petits utilitaires, sans aucune dépendance serveur : importable côté navigateur. */

/** Aircall : métadonnées d'appel uniquement (section 00.7 du prompt maître). Les champs d'analyse sont absents ou vides. */
export type AircallMeta = {
  source: "aircall"; aircallId: number; direction: "inbound" | "outbound"; repondu: boolean; dureeSec: number; motifManque: string | null;
  agent: string | null; numero: string; ligne: string | null;
  enregistrement?: boolean; messagerie?: boolean; resume?: string | null; sujets?: string[]; sentiment?: string | null; transcription?: unknown; analysePending?: boolean; // anciens champs, toujours vides
};
export const isAircallMeta = (m: unknown): m is AircallMeta => !!m && typeof m === "object" && (m as AircallMeta).source === "aircall";

export type GmailMeta = { source: "gmail"; messageId: string; threadId: string; direction: "recu" | "envoye"; objet: string; de: string; a: string; extrait: string; boite?: string | null };
export const isGmailMeta = (m: unknown): m is GmailMeta => !!m && typeof m === "object" && (m as GmailMeta).source === "gmail";

export const fmtDuree = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${String(s % 60).padStart(2, "0")}` : ""}` : `${s} s`);
