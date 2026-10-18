/* eslint-disable @next/next/no-img-element */
import { Paperclip, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Empty } from "@/components/ui/empty";
import type { ThreadMessage } from "./load";

function fmtTime(d: Date) {
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(d)
    : new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function MessageThread({ messages, meId, emptyText, teamSide = false }: { messages: ThreadMessage[]; meId: string; emptyText: string; teamSide?: boolean }) {
  if (messages.length === 0) return <Empty icon={MessageCircle} title="Aucun message" text={emptyText} />;
  return (
    <ol className="flex flex-col gap-3">
      {messages.map((m) => {
        const mine = teamSide ? m.author?.role === "ADMIN" : m.author?.id === meId;
        const name = m.author?.firstName ?? (m.author?.role === "ADMIN" ? "Acco" : "Client");
        return (
          <li key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
            {!mine && <Avatar initials={name[0]?.toUpperCase() ?? "?"} src={m.author?.avatarUrl} size={30} className="mt-1 shrink-0" />}
            <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
              <div className={`rounded-2xl border px-4 py-2.5 ${mine ? "border-title bg-title text-bg" : "border-border bg-surface text-text-strong"}`}>
                {!mine && <p className={`mb-0.5 text-xs font-semibold ${m.author?.role === "ADMIN" ? "text-blue" : "text-text"}`}>{name}{m.author?.role === "ADMIN" ? " · Acco" : ""}</p>}
                {m.body && <p className="whitespace-pre-wrap text-sm">{m.body}</p>}
                {m.attachments.length > 0 && (
                  <ul className={`mt-2 grid gap-1 ${m.attachments.length > 1 ? "grid-cols-2" : ""}`}>
                    {m.attachments.map((a, i) => (
                      <li key={i}>
                        <a href={a.url ?? "#"} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg">
                          {a.mimeType?.startsWith("image/") && a.url ? (
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
              <p className="mt-1 px-1 text-[11px] text-muted">{m.siteName ? `${m.siteName} · ` : ""}{fmtTime(m.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
