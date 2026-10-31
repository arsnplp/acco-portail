"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { Paperclip, Send, X, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Empty } from "@/components/ui/empty";
import type { ThreadMessage } from "./load";

type Props = {
  messages: ThreadMessage[];
  me: { id: string; firstName: string | null; role: "ADMIN" | "CLIENT" };
  teamSide?: boolean;
  sites: { id: string; name: string }[];
  placeholder: string;
  emptyText: string;
  action: (fd: FormData) => Promise<void>;
  offsetNav?: boolean;
};

function fmtTime(d: Date) {
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(d)
    : new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function Chat({ messages, me, teamSide = false, sites, placeholder, emptyText, action, offsetNav = true }: Props) {
  const [optimistic, addOptimistic] = useOptimistic(messages, (state, m: ThreadMessage) => [...state, m]);
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [body, setBody] = useState("");

  function submit(fd: FormData) {
    const text = String(fd.get("body") ?? "").trim();
    const siteId = String(fd.get("siteId") ?? "");
    if (!text && files.length === 0) return;
    const pending: ThreadMessage = {
      id: `tmp-${Date.now()}`, body: text, createdAt: new Date(),
      author: { id: me.id, firstName: me.firstName, avatarUrl: null, role: me.role, email: "" },
      siteName: sites.find((s) => s.id === siteId)?.name ?? null,
      attachments: files.map((f) => ({ storagePath: "", fileName: f.name, mimeType: f.type, url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null })),
    };
    // Affichage immédiat, remise à zéro du champ, envoi en arrière-plan.
    setBody(""); setFiles([]); if (fileRef.current) fileRef.current.value = "";
    startTransition(async () => {
      addOptimistic(pending);
      await action(fd);
    });
    setTimeout(() => bottomRef.current?.scrollIntoView({ block: "end" }), 50);
  }

  return (
    <>
      {optimistic.length === 0 ? <Empty icon={MessageCircle} title="Aucun message" text={emptyText} /> : (
        <ol className="flex flex-col gap-3">
          {optimistic.map((m) => {
            const mine = teamSide ? (m.author?.role && m.author.role !== "CLIENT") : m.author?.id === me.id;
            const name = m.author?.firstName ?? ((m.author?.role && m.author.role !== "CLIENT") ? "Acco" : "Client");
            const sending = m.id.startsWith("tmp-");
            return (
              <li key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {!mine && <Avatar initials={name[0]?.toUpperCase() ?? "?"} src={m.author?.avatarUrl} size={30} className="mt-1 shrink-0" />}
                <div className={`flex max-w-[80%] flex-col ${mine ? "items-end" : "items-start"}`}>
                  <div className={`rounded-2xl border px-4 py-2.5 ${mine ? "border-title bg-title text-bg" : "border-border bg-surface text-text-strong"} ${sending ? "opacity-70" : ""}`}>
                    {!mine && <p className={`mb-0.5 text-xs font-semibold ${(m.author?.role && m.author.role !== "CLIENT") ? "text-blue" : "text-text"}`}>{name}{(m.author?.role && m.author.role !== "CLIENT") ? " · Acco" : ""}</p>}
                    {m.body && <p className="whitespace-pre-wrap text-sm">{m.body}</p>}
                    {m.attachments.length > 0 && (
                      <ul className={`mt-2 grid gap-1 ${m.attachments.length > 1 ? "grid-cols-2" : ""}`}>
                        {m.attachments.map((a, i) => (
                          <li key={i}>
                            <a href={a.url ?? "#"} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg">
                              {a.mimeType?.startsWith("image/") && a.url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={a.url} alt="" className="max-h-48 w-full object-cover" />
                              ) : (
                                <span className={`inline-flex items-center gap-1.5 text-xs underline ${mine ? "text-bg" : "text-title"}`}><Paperclip size={12} /> {a.fileName}</span>
                              )}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <p className="mt-1 px-1 text-[11px] text-muted">{m.siteName ? `${m.siteName} · ` : ""}{sending ? "Envoi…" : fmtTime(new Date(m.createdAt))}</p>
                </div>
              </li>
            );
          })}
          <div ref={bottomRef} />
        </ol>
      )}

      <form
        ref={formRef}
        action={submit}
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
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={placeholder}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border border-border bg-surface px-4 py-3 text-base text-title placeholder:text-muted outline-none focus:border-blue"
            onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 128) + "px"; }}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) formRef.current?.requestSubmit(); }}
          />
          <button type="submit" aria-label="Envoyer" disabled={!body.trim() && files.length === 0} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-title text-bg disabled:opacity-40">
            <Send size={18} />
          </button>
        </div>
      </form>
    </>
  );
}
