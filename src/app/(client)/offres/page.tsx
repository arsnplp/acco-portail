import { Tag } from "lucide-react";
import { Page } from "@/components/page";
import { Empty } from "@/components/ui/empty";

export const metadata = { title: "Offres" };

export default function OffresPage() {
  return (
    <Page title="Offres" subtitle="Des services pour aller plus loin avec votre site.">
      <Empty icon={Tag} title="Bientôt disponible" text="Le catalogue arrive à l’étape 4." />
    </Page>
  );
}
