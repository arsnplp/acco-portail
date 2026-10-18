import { MessageCircle } from "lucide-react";
import { Page } from "@/components/page";
import { Empty } from "@/components/ui/empty";

export const metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <Page title="Messages" subtitle="Discutez directement avec l’équipe Acco.">
      <Empty icon={MessageCircle} title="Bientôt disponible" text="La messagerie arrive à l’étape 3." />
    </Page>
  );
}
