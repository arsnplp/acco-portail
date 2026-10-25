"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { initialsOf } from "@/lib/crm";

/** Icône du site, ou initiales de la société si pas de site (ou si l'image ne charge pas). */
export function Logo({ src, name, className = "size-6" }: { src: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{initialsOf(name)}</>;
  // Une image déjà en échec avant l'hydratation ne relance pas onError : on vérifie au montage.
  return <img ref={(el) => { if (el?.complete && el.naturalWidth === 0) setFailed(true); }} src={src} alt="" className={className} onError={() => setFailed(true)} />;
}
