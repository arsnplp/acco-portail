/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/cn";
import { couleurPour, initialesDe, logoSrc } from "@/lib/logo-utils";

/**
 * Vignette logo d'un client (00.1) : l'image déposée, sinon une pastille aux initiales avec une couleur stable.
 * Utilisable partout (fiche, listes, cartes Kanban, sélecteurs) ; les images se chargent en différé.
 */
export function LogoClient({ id, name, logo, size = 40, className, rond = false }: { id: string; name: string; logo: string | null | undefined; size?: number; className?: string; rond?: boolean }) {
  const forme = rond ? "rounded-full" : "rounded-xl";
  if (logo) {
    return <img src={logoSrc(id, logo)} alt="" width={size} height={size} loading="lazy" decoding="async" className={cn("shrink-0 border border-border bg-surface object-cover", forme, className)} style={{ width: size, height: size }} />;
  }
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-center justify-center font-title font-bold text-white", forme, className)} style={{ width: size, height: size, background: couleurPour(id), fontSize: Math.max(10, Math.round(size * 0.38)) }}>
      {initialesDe(name)}
    </span>
  );
}
