import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

export const metadata = { title: "Commercial" };

export default function CrmHome() {
  return (
    <main className="px-4 py-4">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-text hover:text-title">
        <ArrowLeftIcon size={16} aria-hidden /> Tableau de bord
      </Link>
    </main>
  );
}
