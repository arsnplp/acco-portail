"use client";

import { useEffect } from "react";

/** Enregistre le service worker au chargement (nécessaire pour le push et le mode installé). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
