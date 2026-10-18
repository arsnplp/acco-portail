import { AdminPage } from "@/components/admin/page";
import { NewClientForm } from "./form";

export const metadata = { title: "Nouveau client" };

export default function NouveauClientPage() {
  return (
    <AdminPage title="Nouveau client" back={{ href: "/admin/clients", label: "Clients" }}>
      <NewClientForm />
    </AdminPage>
  );
}
