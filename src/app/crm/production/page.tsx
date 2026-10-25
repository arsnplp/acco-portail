import { FolderKanbanIcon } from "lucide-react";
import { requireTeam } from "@/lib/auth";

export const metadata = { title: "Production" };

export default async function ProductionPage() {
  await requireTeam();
  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <FolderKanbanIcon size={40} className="text-text" aria-hidden />
      <h1 className="mt-4 text-2xl">Mode Production</h1>
      <p className="mt-2 text-sm text-text">Projets, modèles, to-do et tâches récurrentes arrivent à la prochaine étape. Vos projets et tâches de l’ancienne to-do sont déjà importés et apparaîtront ici.</p>
    </main>
  );
}
