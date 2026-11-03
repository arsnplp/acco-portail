import { describe, expect, it } from "vitest";
import { remplacerVariables } from "@/lib/gmail-send";

describe("envois groupés (00.4)", () => {
  it("remplace les variables et vide les inconnues", () => {
    expect(remplacerVariables("Bonjour {{prenom}} de {{societe}} {{inconnue}}", { prenom: "Marie", societe: "Dupont" })).toBe("Bonjour Marie de Dupont ");
  });
});
