"use client";

import { useEffect, useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { PhoneCallIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { appelerAircall } from "@/app/crm/appel-action";
import { e164Client } from "@/components/crm/aircall-dock";

type Etat = { kind: "idle" } | { kind: "pending" } | { kind: "ok"; ligne: string | null; integre?: boolean } | { kind: "erreur"; message: string };

/**
 * Bouton d'appel (click-to-call) : compose dans le téléphone Aircall intégré (AircallDock) s'il est connecté, sinon l'appel
 * sonne dans Aircall Workspace du collaborateur via l'API ; dans les deux cas sans sortir de l'app.
 * Sans compte Aircall (ou Aircall non configuré), repli sur le téléphone de l'appareil (lien tel:) comme avant.
 * En cas d'indisponibilité (Workspace fermé, déjà en ligne), un message l'explique avec un lien de secours.
 */
export function BoutonAppel({ tel, className, children, onClick, stopPropagation = false, title, "aria-label": ariaLabel }: {
  tel: string; className?: string; children: ReactNode; onClick?: () => void; stopPropagation?: boolean; title?: string; "aria-label"?: string;
}) {
  const [etat, setEtat] = useState<Etat>({ kind: "idle" });
  const href = `tel:${tel.replace(/\s/g, "")}`;

  useEffect(() => {
    if (etat.kind !== "ok") return;
    const t = setTimeout(() => setEtat({ kind: "idle" }), 5000);
    return () => clearTimeout(t);
  }, [etat]);

  const stop = (e: MouseEvent | PointerEvent) => { if (stopPropagation) e.stopPropagation(); };
  const lancer = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); // dans un <summary>, ne pas replier le bloc
    stop(e);
    onClick?.();
    if (etat.kind === "pending") return;
    // Sur téléphone ou tablette, pas de Workspace Aircall (ordinateur seulement) : on appelle directement avec l'appareil.
    if (window.matchMedia("(max-width: 1023px)").matches) { window.location.href = href; return; }
    setEtat({ kind: "pending" });
    try {
      // 1. Téléphone Aircall intégré (volet en bas à droite) s'il est connecté : on compose dedans, on raccroche dedans.
      const dock = window.__accoAircall;
      const num = e164Client(tel);
      if (dock?.isLoggedIn() && num) {
        const d = await dock.dial(num);
        if (d.ok) { setEtat({ kind: "ok", ligne: null, integre: true }); return; }
        if (d.code === "in_call") { setEtat({ kind: "erreur", message: "Vous êtes déjà en ligne dans le téléphone intégré : raccrochez d’abord." }); return; }
      }
      // 2. Sinon, l'API Aircall fait sonner Aircall Workspace (application ou onglet) du collaborateur.
      const r = await appelerAircall(tel);
      if (r.ok) { setEtat({ kind: "ok", ligne: r.ligne }); return; }
      if (r.raison === "pas_de_compte" || r.raison === "non_configure") { setEtat({ kind: "idle" }); window.location.href = href; return; }
      setEtat({ kind: "erreur", message: r.message });
    } catch {
      setEtat({ kind: "erreur", message: "Impossible de joindre Aircall pour l’instant." });
    }
  };

  return (
    <>
      <button type="button" onClick={lancer} onPointerDown={stop} title={title ?? `Appeler ${tel} avec Aircall`} aria-label={ariaLabel} aria-busy={etat.kind === "pending"} className={cn(className, etat.kind === "pending" && "animate-pulse")}>
        {children}
      </button>
      {etat.kind !== "idle" && etat.kind !== "pending" && (
        <div role="status" className="fixed inset-x-0 bottom-4 z-[70] flex justify-center px-3" style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
          <div className={cn("flex w-full max-w-md items-start gap-3 rounded-card border bg-surface px-4 py-3 text-sm shadow-2xl shadow-black/50", etat.kind === "ok" ? "border-green/50" : "border-pink/50")}>
            <PhoneCallIcon size={18} className={cn("mt-0.5 shrink-0", etat.kind === "ok" ? "text-green" : "text-pink")} aria-hidden />
            <div className="min-w-0 flex-1">
              {etat.kind === "ok" ? (
                <p className="text-title">{etat.integre ? `Appel de ${tel} lancé dans le téléphone intégré (en bas à droite) : raccrochez-y avec le bouton rouge.` : `Appel lancé dans Aircall${etat.ligne ? ` (ligne ${etat.ligne})` : ""} : décrochez dans Workspace, le numéro ${tel} est composé.`}</p>
              ) : (
                <>
                  <p className="text-title">{etat.message}</p>
                  <a href={href} className="mt-1 inline-block text-xs text-text underline-offset-2 hover:underline" onClick={() => setEtat({ kind: "idle" })}>Appeler avec le téléphone de l’appareil</a>
                </>
              )}
            </div>
            <button type="button" onClick={() => setEtat({ kind: "idle" })} aria-label="Fermer" className="shrink-0 text-text hover:text-title"><XIcon size={16} /></button>
          </div>
        </div>
      )}
    </>
  );
}
