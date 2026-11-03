import { describe, expect, it } from "vitest";
import { chargesPourMois } from "@/lib/finance";

const d = (s: string) => new Date(`${s}T12:00:00Z`);
describe("charges (00.10 §4, PAY-03)", () => {
  const charges = [
    { type: "MENSUELLE" as const, montantCents: 100000, debut: d("2026-01-01"), fin: null, categorie: "local", principale: true },
    { type: "MENSUELLE" as const, montantCents: 5000, debut: d("2026-03-01"), fin: d("2026-06-30"), categorie: "logiciels", principale: false },
    { type: "MENSUELLE" as const, montantCents: 250000, debut: d("2026-01-01"), fin: null, categorie: "salaires", principale: true },
    { type: "PONCTUELLE" as const, montantCents: 80000, debut: d("2026-05-10"), fin: null, categorie: "marketing", principale: false },
  ];
  it("trois charges mensuelles et une ponctuelle : total, principales et répartition du mois", () => {
    const mai = chargesPourMois(charges, d("2026-05-15"));
    expect(mai.total).toBe(100000 + 5000 + 250000 + 80000);
    expect(mai.principales).toBe(350000);
    expect(mai.parCategorie).toEqual({ local: 100000, logiciels: 5000, salaires: 250000, marketing: 80000 });
  });
  it("une charge terminée ou future ne compte pas, la ponctuelle seulement son mois", () => {
    const aout = chargesPourMois(charges, d("2026-08-15"));
    expect(aout.total).toBe(350000);
    expect(chargesPourMois(charges, d("2026-02-15")).parCategorie.logiciels).toBeUndefined();
  });
});
