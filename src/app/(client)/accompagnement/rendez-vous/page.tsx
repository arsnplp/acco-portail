import { requireClientContext } from "@/lib/auth";
import { addDays } from "@/lib/format";
import { Page } from "@/components/page";
import { BackLink } from "@/components/ui/back-link";
import { RdvForm } from "./form";

export const metadata = { title: "Prendre rendez-vous" };

/** Accompagnement → Prendre rendez-vous avec son conseiller. */
export default async function RendezVousPage() {
  await requireClientContext();
  const demain = addDays(1).toISOString().slice(0, 10);
  return (
    <Page title={<><BackLink fallback="/accompagnement" label="Accompagnement" className="mb-3" />Prendre rendez-vous.</>} subtitle="Un moment avec votre conseiller pour faire le point, poser vos questions ou avancer sur un projet.">
      <RdvForm minDate={demain} />
    </Page>
  );
}
