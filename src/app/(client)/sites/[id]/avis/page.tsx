import { Sparkles } from "lucide-react";
import { Empty } from "@/components/ui/empty";

export const metadata = { title: "Avis" };

export default function Page() {
  return <Empty icon={Sparkles} title="Bientôt disponible" text="Le module Avis Google arrive à l’étape 7." />;
}
