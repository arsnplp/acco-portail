import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireClientSite } from "@/lib/sites";
import { NewChangeForm } from "./form";

export const metadata = { title: "Nouvelle demande" };

export default async function NouvellePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site } = await requireClientSite(id);
  return (
    <div>
      <Link href={`/sites/${site.id}/modifications`} className="inline-flex items-center gap-1 text-sm text-text hover:text-title">
        <ChevronLeft size={16} /> Modifications
      </Link>
      <h2 className="mt-3 text-xl">Que souhaitez-vous changer ?</h2>
      <p className="mt-1 text-sm text-text">Décrivez simplement, on s’occupe du reste.</p>
      <div className="mt-5">
        <NewChangeForm siteId={site.id} />
      </div>
    </div>
  );
}
