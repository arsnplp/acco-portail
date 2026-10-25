import Image from "next/image";
import type { ProspectStatut } from "@prisma/client";
import { ETAPE_IMAGE, STATUT } from "@/lib/crm";
import { cn } from "@/lib/cn";

/** Bandeau illustré d'une étape du pipeline, avec son nom par-dessus (ex. « À signer »). */
export function EtapeBanner({ statut, className, children, corner }: { statut: ProspectStatut; className?: string; children?: React.ReactNode; corner?: React.ReactNode }) {
  const src = ETAPE_IMAGE[statut];
  return (
    <header className={cn("relative flex items-end overflow-hidden bg-surface-2", className)}>
      {src && <Image src={src} alt="" fill sizes="(min-width: 1024px) 300px, 90vw" className="object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
      {corner && <div className="absolute top-2 right-2">{corner}</div>}
      <div className="relative flex w-full items-center gap-2 px-3 pb-2">
        <h2 className="font-title text-lg font-extrabold text-white drop-shadow">{STATUT[statut].label}</h2>
        {children}
      </div>
    </header>
  );
}
