import type { ReferralStatus } from "@prisma/client";

export const REFERRAL_STEPS: { key: ReferralStatus; label: string }[] = [
  { key: "ENVOYEE", label: "Envoyée" },
  { key: "CONTACTEE", label: "Contactée" },
  { key: "SIGNEE", label: "Signée" },
  { key: "RECOMPENSE_VALIDEE", label: "Récompense" },
];
