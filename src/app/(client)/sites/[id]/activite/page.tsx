import { Inbox, Phone, Mail } from "lucide-react";
import { requireClientSite, monthRange } from "@/lib/sites";
import { prisma } from "@/lib/prisma";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";
import { CONTACT_STATUS } from "@/lib/labels";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Activité" };

export default async function ActivitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { site } = await requireClientSite(id);
  const { start, end } = monthRange();
  const [count, requests] = await Promise.all([
    prisma.contactRequest.count({ where: { siteId: site.id, createdAt: { gte: start, lt: end } } }),
    prisma.contactRequest.findMany({ where: { siteId: site.id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return (
    <div>
      <Card className="flex items-baseline gap-3">
        <span className="font-title text-4xl font-extrabold text-title">{count}</span>
        <span className="text-text">demande{count > 1 ? "s" : ""} de clients ce mois-ci</span>
      </Card>

      <SectionTitle emoji="📬">Demandes reçues</SectionTitle>
      {requests.length === 0 ? (
        <Empty icon={Inbox} title="Aucune demande pour l’instant" text="Les messages envoyés depuis les formulaires de votre site arriveront ici." />
      ) : (
        <div className="grid gap-2">
          {requests.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-title">{r.name}</p>
                  <p className="text-xs text-text">{r.type ?? "Message"} · {timeAgo(r.createdAt)}</p>
                </div>
                <Badge tone={CONTACT_STATUS[r.status].tone}>{CONTACT_STATUS[r.status].label}</Badge>
              </div>
              <p className="mt-3 text-sm text-text-strong">{r.message}</p>
              <div className="mt-3 flex gap-2">
                {r.phone && (
                  <a href={`tel:${r.phone.replace(/\s/g, "")}`} className="inline-flex h-9 items-center gap-1.5 rounded-card border border-border px-3 text-sm font-medium text-title">
                    <Phone size={14} /> Appeler
                  </a>
                )}
                {r.email && (
                  <a href={`mailto:${r.email}`} className="inline-flex h-9 items-center gap-1.5 rounded-card border border-border px-3 text-sm font-medium text-title">
                    <Mail size={14} /> Email
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
