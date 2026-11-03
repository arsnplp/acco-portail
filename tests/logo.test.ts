import { describe, expect, it } from "vitest";
import { couleurPour, initialesDe, logoSrc } from "@/lib/logo-utils";

describe("logo (00.1)", () => {
  it("initiales : deux lettres, stables", () => { expect(initialesDe("Boulangerie Dupont")).toBe("BD"); expect(initialesDe("Acco")).toBe("AC"); expect(initialesDe("  ")).toBe("?"); });
  it("couleur stable dérivée de l'identifiant", () => { expect(couleurPour("abc")).toBe(couleurPour("abc")); expect(couleurPour("abc")).not.toBe(couleurPour("abd")); expect(couleurPour("abc")).toMatch(/^hsl\(/); });
  it("la vignette est servie par l'application, jamais par un service externe", () => { expect(logoSrc("c1", "logos/c1/1.webp")).toMatch(/^\/api\/logo\/c1\?mini=1&v=/); });
});
