import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

/** Les espaces de l'équipe, chacun incarné par un personnage. Pour en ajouter un : une ligne ici + son image dans public/espaces. */
const ESPACES = [
  { href: "/crm", name: "Commercial", text: "CRM, prospects et ventes", image: "/espaces/commercial.webp" },
];

export function Espaces() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {ESPACES.map((e) => (
        <Link
          key={e.href}
          href={e.href}
          className="group relative flex flex-col overflow-hidden rounded-card border border-border bg-surface transition-colors hover:border-text"
        >
          <div className="relative aspect-square w-full bg-[radial-gradient(circle_at_50%_70%,var(--surface-2),var(--surface)_70%)]">
            <Image
              src={e.image}
              alt={`Personnage de l’espace ${e.name}`}
              fill
              sizes="(min-width: 640px) 240px, 45vw"
              className="object-contain object-bottom px-2 pt-3 transition-transform duration-300 group-hover:scale-[1.04]"
              priority
            />
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border p-3">
            <div className="min-w-0">
              <p className="font-title font-semibold text-title">{e.name}</p>
              <p className="truncate text-xs text-text">{e.text}</p>
            </div>
            <ArrowRightIcon size={16} className="shrink-0 text-text transition-transform group-hover:translate-x-0.5 group-hover:text-title" aria-hidden />
          </div>
        </Link>
      ))}
    </div>
  );
}
