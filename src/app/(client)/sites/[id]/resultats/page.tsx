import { Sparkles } from "lucide-react";
import { Empty } from "@/components/ui/empty";

export const metadata = { title: "Résultats" };

export default function Page() {
  return <Empty icon={Sparkles} title="Bientôt disponible" text="Vos visites depuis Google et vos recherches les plus fréquentes arrivent à l’étape 6." />;
}
