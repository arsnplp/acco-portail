"use client";

import { Select } from "@/components/ui/field";

/** Select qui soumet son formulaire au changement. */
export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <Select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
