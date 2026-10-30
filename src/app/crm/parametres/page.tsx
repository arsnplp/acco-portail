import { requireTeam } from "@/lib/auth";
import { MesParametres } from "@/app/admin/parametres/moi";

export const metadata = { title: "Paramètres" };

/** Paramètres d'un commercial : son compte Google (emails du CRM), ses notifications, son accès. */
export default async function CrmParametresPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const me = await requireTeam();
  const { google } = await searchParams;
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl">Paramètres</h1>
      <p className="mt-1 text-sm text-text">{me.firstName ?? me.email}</p>
      <MesParametres user={me} google={google} next="/crm/parametres" />
    </main>
  );
}
