/** Interrupteur on/off (case à cocher stylée), utilisable dans un formulaire. */
export function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm text-text-strong">{label}</span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="absolute inset-0 rounded-full border border-border bg-surface-2 transition-colors peer-checked:bg-green peer-checked:border-green" />
        <span className="absolute left-0.5 size-5 rounded-full bg-text transition-transform peer-checked:translate-x-5 peer-checked:bg-bg" />
      </span>
    </label>
  );
}
