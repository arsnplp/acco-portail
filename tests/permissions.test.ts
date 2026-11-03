import { describe, expect, it } from "vitest";
import { PRESETS, can, droitsDe, estDirection, estExterne } from "@/lib/permissions";
import { homeFor } from "@/lib/roles";

const u = (role: "ADMIN" | "COMMERCIAL" | "DEV" | "EXPERT" | "SPECIALISTE" | "CLIENT", droits: string[] = [], email = "x@acco-lab.fr") => ({ id: "u", role, email, droits });

describe("droits (20.1)", () => {
  it("un client n'a aucun droit d'équipe", () => { expect(can(u("CLIENT"), "pilotage")).toBe(false); });
  it("le gestionnaire (Arsène) a tous les droits", () => { expect(can(u("ADMIN", [], "arsene@acco-lab.fr"), "go_live")).toBe(true); expect(can(u("ADMIN", [], "arsene@acco-lab.fr"), "validation_technique")).toBe(true); });
  it("un ADMIN non gestionnaire (Bilel) n'a pas le go-live ni la validation technique", () => { expect(can(u("ADMIN"), "go_live")).toBe(false); expect(can(u("ADMIN"), "validation_technique")).toBe(false); expect(can(u("ADMIN"), "validation_commerciale")).toBe(true); });
  it("Lucas (preset) : Direction et validation commerciale sans administration ni mode Admin", () => {
    const lucas = u("COMMERCIAL", [...PRESETS.lucas.droits]);
    expect(estDirection(lucas)).toBe(true); expect(can(lucas, "validation_commerciale")).toBe(true); expect(can(lucas, "equipe")).toBe(false); expect(can(lucas, "reglages")).toBe(false);
    expect(PRESETS.lucas.modeDefaut).toBe("COMMERCIAL");
  });
  it("les prestataires sont externes et sans droit", () => { expect(estExterne(u("EXPERT"))).toBe(true); expect(droitsDe(u("SPECIALISTE"))).toEqual([]); });
});

describe("accueil selon le mode (2.2), sans boucle", () => {
  it("un développeur réglé sur le mode Commercial ne va pas en Prospection", () => { expect(homeFor("DEV", "COMMERCIAL")).toBe("/admin/suivi"); });
  it("le mode Admin est réservé aux admins", () => { expect(homeFor("COMMERCIAL", "ADMIN")).toBe("/crm"); expect(homeFor("ADMIN", "ADMIN")).toBe("/admin"); });
  it("Arsène démarre en Production", () => { expect(homeFor("ADMIN", "PRODUCTION")).toBe("/admin/production"); });
  it("un client va toujours à son portail", () => { expect(homeFor("CLIENT", "DIRECTION")).toBe("/"); });
});
