import { Sparkles } from "lucide-react";
import { Empty } from "@/components/ui/empty";

export const metadata = { title: "Conseils" };

export default function Page() {
  return <Empty icon={Sparkles} title="Bientôt disponible" text="Les guides pour améliorer votre visibilité arrivent bientôt." />;
}
