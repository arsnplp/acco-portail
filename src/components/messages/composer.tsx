"use client";

import { useRef, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { useFormStatus } from "react-dom";

export function MessageComposer({ action, sites, placeholder, offsetNav = true }: { action: (fd: FormData) => Promise<void>; sites: { id: string; name: string }[]; placeholder: string; offsetNav?: boolean }) {
  const ref = useRef<HTMLFormElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <form
      ref={ref}
      action={async (fd) => {
        await action(fd);
        ref.current?.reset();
        setFiles([]);
      }}
      className="sticky z-30 mt-6 -mx-4 border-t border-border bg-bg/95 px-4 pt-3 backdrop-blur"
      style={{ bottom: offsetNav ? "calc(var(--nav-h) + env(safe-area-inset-bottom))" : 0, paddingBottom: offsetNav ? 12 : "calc(12px + env(safe-area-inset-bottom))" }}
    >
      {sites.length > 1 && (
        <select name="siteId" defaultValue="" className="mb-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-strong outline-none">
          <option value="">Sujet général</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      {sites.length === 1 && <input type="hidden" name="siteId" value={sites[0].id} />}
      {files.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1">
          {files.map((f, i) => (
            <li key={i} className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-text-strong">
              {f.name.slice(0, 24)}
              <button type="button" onClick={() => { setFiles([]); if (fileRef.current) fileRef.current.value = ""; }} aria-label="Retirer"><X size={12} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border text-text hover:text-title" aria-label="Joindre un fichier">
          <Paperclip size={18} />
          <input ref={fileRef} type="file" name="files" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="sr-only" onChange={(e) => setFiles(Array.from(e.currentTarget.files ?? []))} />
        </label>
        <textarea
          name="body"
          rows={1}
          placeholder={placeholder}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border border-border bg-surface px-4 py-3 text-base text-title placeholder:text-muted outline-none focus:border-blue"
          onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 128) + "px"; }}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ref.current?.requestSubmit(); }}
        />
        <SendButton />
      </div>
    </form>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-label="Envoyer" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-title text-bg disabled:opacity-50">
      <Send size={18} />
    </button>
  );
}
