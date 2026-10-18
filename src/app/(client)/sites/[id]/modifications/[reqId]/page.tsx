import { notFound } from "next/navigation";
import { CheckCircle2, Paperclip } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import { requireClientSite } from "@/lib/sites";
import { prisma } from "@/lib/prisma";
import { signedUrl } from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/field";
import { CHANGE_STATUS, URGENCY } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import { confirmChange, reopenChange } from "../actions";

export default async function ChangeDetailPage({ params, searchParams }: { params: Promise<{ id: string; reqId: string }>; searchParams: Promise<{ creee?: string }> }) {
  const { id, reqId } = await params;
  const { creee } = await searchParams;
  const { site } = await requireClientSite(id);
  const cr = await prisma.changeRequest.findFirst({
    where: { id: reqId, siteId: site.id },
    include: { attachments: true, comments: { include: { author: true }, orderBy: { createdAt: "asc" } }, assignee: true },
  });
  if (!cr) notFound();
  const st = CHANGE_STATUS[cr.status];
  const files = await Promise.all(cr.attachments.map(async (a) => ({ ...a, url: await signedUrl("change-requests", a.storagePath) })));
  const steps = ["RECUE", "EN_COURS", "TERMINEE"] as const;
  const idx = steps.indexOf(cr.status);

  return (
    <div>
      <BackLink fallback={`/sites/${site.id}/modifications`} label="Modifications" />

      {creee && (
        <Card className="mt-3 flex items-start gap-3 border-green/40">
          <CheckCircle2 className="text-green shrink-0" size={20} />
          <p className="text-sm text-text-strong">Demande envoyée. L’équipe vous tient au courant ici et dans Messages.</p>
        </Card>
      )}

      <div className="mt-4 flex items-start justify-between gap-3">
        <h2 className="text-xl">{cr.title}</h2>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <p className="mt-1 text-xs text-text">
        Envoyée le {fmtDate(cr.createdAt)}{cr.page ? ` · ${cr.page}` : ""} · {URGENCY[cr.urgency]}
      </p>

      <ol className="mt-5 grid grid-cols-3 gap-1">
        {steps.map((s, i) => (
          <li key={s} className="flex flex-col items-center gap-2 text-center">
            <span className={`h-1.5 w-full rounded-full ${i <= idx ? (i === 2 ? "bg-green" : i === idx ? "bg-yellow" : "bg-green") : "bg-border"}`} />
            <span className={`text-[11px] ${i === idx ? "font-semibold text-title" : "text-muted"}`}>{CHANGE_STATUS[s].label}</span>
          </li>
        ))}
      </ol>

      <Card className="mt-5">
        <p className="whitespace-pre-wrap text-sm text-text-strong">{cr.description}</p>
        {files.length > 0 && (
          <ul className="mt-4 grid grid-cols-3 gap-2">
            {files.map((f) => (
              <li key={f.id}>
                <a href={f.url ?? "#"} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-sm border border-border bg-surface-2">
                  {f.mimeType?.startsWith("image/") && f.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt="" className="aspect-square w-full object-cover" />
                  ) : (
                    <span className="flex aspect-square items-center justify-center text-text"><Paperclip size={18} /></span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {cr.assignee && <p className="mt-3 text-xs text-text">Suivie par {cr.assignee.firstName ?? "l’équipe Acco"}.</p>}

      {cr.comments.length > 0 && (
        <div className="mt-5 space-y-2">
          {cr.comments.map((c) => (
            <Card key={c.id} className="py-3">
              <p className="text-xs text-muted">{c.author?.firstName ?? "Acco"} · {fmtDate(c.createdAt)}</p>
              <p className="mt-1 text-sm text-text-strong">{c.body}</p>
            </Card>
          ))}
        </div>
      )}

      {cr.status === "TERMINEE" && !cr.confirmedAt && (
        <div className="mt-6 space-y-3">
          <p className="font-semibold text-title">C’est bon pour vous ?</p>
          <form action={confirmChange.bind(null, site.id, cr.id)}>
            <SubmitButton size="lg" className="w-full" pendingLabel="Merci…">Oui, c’est parfait</SubmitButton>
          </form>
          <details className="rounded-card border border-border p-4">
            <summary className="cursor-pointer text-sm font-medium text-text-strong">Non, il manque quelque chose</summary>
            <form action={reopenChange.bind(null, site.id, cr.id)} className="mt-3 space-y-3">
              <Textarea name="reason" placeholder="Dites-nous ce qui ne va pas" required />
              <SubmitButton variant="secondary" className="w-full">Rouvrir la demande</SubmitButton>
            </form>
          </details>
        </div>
      )}
      {cr.confirmedAt && <p className="mt-6 text-center text-sm text-green">Confirmée le {fmtDate(cr.confirmedAt)}. Merci !</p>}
    </div>
  );
}
