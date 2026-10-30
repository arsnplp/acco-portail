"use client";

import { useState } from "react";
import { MoonIcon, SunIcon } from "lucide-react";

export type Theme = "dark" | "light";
const KEY = "acco-theme";

/** Applique le thème sur <html>, le mémorise (cookie lu par le serveur pour éviter le flash, localStorage en secours). */
export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.cookie = `${KEY}=${t}; path=/; max-age=31536000; samesite=lax`;
  try { localStorage.setItem(KEY, t); } catch { /* navigation privée */ }
}

/** Bouton soleil / lune : mode jour ou mode nuit, pour toute l'app. */
export function ThemeToggle({ initial, className = "" }: { initial: Theme; className?: string }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const next: Theme = theme === "light" ? "dark" : "light";
  return (
    <button type="button" onClick={() => { applyTheme(next); setTheme(next); }} aria-label={next === "light" ? "Passer en mode jour" : "Passer en mode nuit"} title={next === "light" ? "Mode jour" : "Mode nuit"}
      className={`flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-text hover:border-text hover:text-title ${className}`}>
      {theme === "light" ? <MoonIcon size={16} /> : <SunIcon size={16} />}
    </button>
  );
}
