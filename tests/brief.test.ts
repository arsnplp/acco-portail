import { describe, expect, it } from "vitest";
import { BRIEF_SECTIONS, completude, type ContenuBrief } from "@/lib/brief";

const tout = (etat: "VALIDE" | "ATTENDU", sauf: string[] = []): ContenuBrief => Object.fromEntries(BRIEF_SECTIONS.map((s) => [s.key, { texte: "x", etat: sauf.includes(s.key) ? "ATTENDU" : etat }]));

describe("brief (10.3)", () => {
  it("complet quand tout est validé", () => { expect(completude(tout("VALIDE"), false).complet).toBe(true); });
  it("une section essentielle manquante bloque, même avec dérogation", () => { const c = completude(tout("VALIDE", ["pages"]), true); expect(c.complet).toBe(false); expect(c.essentielles.map((s) => s.key)).toEqual(["pages"]); });
  it("une section non essentielle manquante passe seulement avec la dérogation d'Arsène", () => { expect(completude(tout("VALIDE", ["photos"]), false).complet).toBe(false); expect(completude(tout("VALIDE", ["photos"]), true).complet).toBe(true); });
});
