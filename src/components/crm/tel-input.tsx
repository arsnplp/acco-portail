"use client";

import { Input } from "@/components/ui/field";
import { formatTel } from "@/lib/crm";

/** Champ téléphone : se met au format « 06 12 34 56 78 » dès qu'on quitte le champ. */
export function TelInput(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <Input {...p} type="tel" inputMode="tel" autoComplete="tel" onBlur={(e) => { e.currentTarget.value = formatTel(e.currentTarget.value) ?? ""; p.onBlur?.(e); }} />;
}
