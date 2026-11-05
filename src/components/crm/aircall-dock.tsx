"use client";

import { useEffect, useRef, useState } from "react";
import { PhoneIcon, XIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Dock = { dial: (e164: string) => Promise<{ ok: true } | { ok: false; code: string }>; isLoggedIn: () => boolean };
declare global { interface Window { __accoAircall?: Dock } }

/** Numéro au format E.164 côté navigateur (« 06 12 34 56 78 » → « +33612345678 »). */
export function e164Client(tel: string) {
  const d = tel.replace(/[^\d+]/g, "");
  if (!d) return null;
  if (d.startsWith("+")) return d;
  if (d.startsWith("00")) return `+${d.slice(2)}`;
  return d.startsWith("0") ? `+33${d.slice(1)}` : `+${d}`;
}

/**
 * Téléphone Aircall intégré (Aircall Workspace dans un volet de l'app, SDK aircall-everywhere) : on compose, on parle et on
 * RACCROCHE sans quitter l'app, avec les boutons du téléphone lui-même (Aircall n'offre aucune commande « raccrocher » par API).
 * Le collaborateur se connecte une fois à Aircall dans le volet ; ensuite les boutons d'appel de l'app composent dedans.
 * Ordinateur seulement (le téléphone intégré n'existe pas sur mobile : là, les boutons d'appel passent par l'API ou le téléphone).
 */
export function AircallDock() {
  const [open, setOpen] = useState(false);
  const [logged, setLogged] = useState(false);
  const [enAppel, setEnAppel] = useState(false);
  const [charge, setCharge] = useState(false);
  const loggedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(max-width: 1023px)").matches) return;
    let ws: import("aircall-everywhere").default | null = null;
    let annule = false;
    import("aircall-everywhere").then(({ default: AircallWorkspace }) => {
      if (annule) return;
      ws = new AircallWorkspace({
        domToLoadWorkspace: "#aircall-dock-phone", size: "big", debug: false,
        onLogin: () => { loggedRef.current = true; setLogged(true); },
        onLogout: () => { loggedRef.current = false; setLogged(false); },
      });
      setCharge(true);
      const ouvrir = () => { setEnAppel(true); setOpen(true); };
      ws.on("incoming_call", ouvrir);
      ws.on("outgoing_call", ouvrir);
      ws.on("outgoing_answered", () => setEnAppel(true));
      ws.on("call_ended", () => setEnAppel(false));
      window.__accoAircall = {
        isLoggedIn: () => loggedRef.current,
        dial: (num) => new Promise((resolve) => {
          if (!ws || !loggedRef.current) return resolve({ ok: false, code: "not_ready" });
          ws.send("dial_number", { phone_number: num }, (ok, data) => {
            if (ok) { setOpen(true); resolve({ ok: true }); } else resolve({ ok: false, code: String((data as { message?: string } | undefined)?.message ?? "unknown_error") });
          });
        }),
      };
    }).catch((e) => console.warn("[aircall-dock]", (e as Error).message));
    return () => { annule = true; delete window.__accoAircall; };
  }, []);

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[65] hidden flex-col items-end gap-2 lg:flex" style={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
      {/* Le volet reste monté quand il est replié : l'appel continue, le micro aussi. */}
      <div className={cn("pointer-events-auto overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50", open ? "block" : "hidden")}>
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-sm">
          <PhoneIcon size={14} className={enAppel ? "animate-pulse text-green" : "text-text"} aria-hidden />
          <span className="font-semibold text-title">Téléphone Aircall</span>
          <span className="text-xs text-text">{enAppel ? "· en ligne : raccrochez avec le bouton rouge du téléphone" : logged ? "· connecté" : charge ? "· connectez-vous à Aircall ci-dessous" : "· chargement…"}</span>
          <button type="button" onClick={() => setOpen(false)} aria-label="Replier" className="ml-auto flex size-7 items-center justify-center rounded-full text-text hover:text-title"><ChevronDownIcon size={16} /></button>
        </div>
        <div id="aircall-dock-phone" className="h-[376px] w-[666px] bg-black" />
      </div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? "Replier le téléphone" : "Ouvrir le téléphone Aircall"} title="Téléphone Aircall intégré"
        className={cn("pointer-events-auto relative flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold shadow-lg shadow-black/40", enAppel ? "border-green bg-green text-bg" : "border-border bg-surface text-title hover:border-text")}>
        {open ? <XIcon size={16} aria-hidden /> : <PhoneIcon size={16} aria-hidden />}
        {enAppel ? "En appel" : "Téléphone"}
        <span className={cn("absolute -top-0.5 -right-0.5 size-2.5 rounded-full border border-bg", logged ? "bg-green" : "bg-muted")} aria-hidden />
      </button>
    </div>
  );
}
