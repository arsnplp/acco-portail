import { LogOut } from "lucide-react";
import { requireClientContext, displayName } from "@/lib/auth";
import { Page } from "@/components/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Mon compte" };

export default async function ComptePage() {
  const { user, client, membership } = await requireClientContext();
  return (
    <Page title="Mon compte">
      <SectionTitle emoji="🏪">Entreprise</SectionTitle>
      <Card>
        <p className="font-semibold text-title">{client.name}</p>
        <p className="text-sm text-text mt-1">{client.address ?? "Adresse non renseignée"}</p>
        <p className="text-sm text-text">{client.phone ?? ""}</p>
      </Card>

      <SectionTitle emoji="👤">Vous</SectionTitle>
      <Card>
        <p className="font-semibold text-title">{displayName(user)}</p>
        <p className="text-sm text-text mt-1">{user.email}</p>
        <p className="text-xs text-muted mt-2">{membership.role === "OWNER" ? "Gérant" : "Membre de l’équipe"}</p>
      </Card>

      <div className="mt-8">
        <form action="/auth/deconnexion" method="post">
          <Button variant="secondary" type="submit" className="w-full">
            <LogOut size={18} strokeWidth={1.75} /> Se déconnecter
          </Button>
        </form>
      </div>
    </Page>
  );
}
