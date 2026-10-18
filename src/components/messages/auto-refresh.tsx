"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Rafraîchit la page toutes les N secondes quand l'onglet est visible. */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
