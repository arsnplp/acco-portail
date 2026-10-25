import Image from "next/image";
import type { ProspectStatut } from "@prisma/client";
import { ETAPE_IMAGE, ETAPE_IMAGE_PC, STATUT } from "@/lib/crm";
import { cn } from "@/lib/cn";

/** Bandeau illustré d'une étape du pipeline, avec son nom par-dessus (ex. « À signer »). */
export function EtapeBanner({ statut, className, children, corner, grand = false }: { statut: ProspectStatut; className?: string; children?: React.ReactNode; corner?: React.ReactNode; grand?: boolean }) {
  const src = (grand ? ETAPE_IMAGE_PC : ETAPE_IMAGE)[statut];
  return (
    <header className={cn("relative flex items-end overflow-hidden bg-surface-2", className)}>
      {src && <Image src={src} alt="" fill sizes={grand ? "(min-width: 1200px) 1150px, 100vw" : "(min-width: 1024px) 300px, 90vw"} className="object-cover" priority={grand} />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
      {corner && <div className="absolute top-2 right-2">{corner}</div>}
      <div className={cn("relative flex w-full items-center gap-2", grand ? "px-6 pb-5" : "px-3 pb-2")}>
        <h2 className={cn("font-title font-extrabold text-white drop-shadow", grand ? "text-3xl" : "text-lg")}>{STATUT[statut].label}</h2>
        {children}
      </div>
    </header>
  );
}
