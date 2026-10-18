import { prisma } from "@/lib/prisma";
import { AdminPage } from "@/components/admin/page";
import { Card, SectionTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { timeAgo } from "@/lib/format";
import { markContacted, markSigned, closeReferral } from "./actions";

export const metadata = { title: "Recommandations" };

export default async function RecommandationsAdminPage() {
  const [referrals, clients, reward] = await Promise.all([
    prisma.referral.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { referrer: { select: { name: true } }, referred: { select: { name: true } } } }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.setting.findUnique({ where: { key: "referral_reward_label" } }),
  ]);
  const open = referrals.filter((r) => r.status === "ENVOYEE" || r.status === "CONTACTEE");
  const done = referrals.filter((r) => !open.includes(r));

  return (
    <AdminPage title="Recommandations">
      <p className="-mt-3 mb-4 text-xs text-muted">Récompense actuelle : {reward?.value ?? "non définie"} (modifiable dans Paramètres).</p>
      <SectionTitle emoji="📞">À traiter ({open.length})</SectionTitle>
      {open.length === 0 ? <p className="text-sm text-text">Aucune recommandation en attente.</p> : (
        <div className="grid gap-3">
          {open.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-title">{r.contactName}</p>
                  <p className="text-xs text-text">Recommandé par {r.referrer.name} · {r.kind === "LIEN" ? "via son lien" : "contact donné"} · {timeAgo(r.createdAt)}</p>
                  <p className="mt-2 text-sm text-text-strong">
                    {r.contactPhone && <a href={`tel:${r.contactPhone.replace(/\s/g, "")}`} className="underline">{r.contactPhone}</a>}{r.contactPhone && r.contactEmail ? " · " : ""}
                    {r.contactEmail && <a href={`mailto:${r.contactEmail}`} className="underline">{r.contactEmail}</a>}
                  </p>
                  {r.note && <p className="mt-1 text-sm text-text">« {r.note} »</p>}
                </div>
                <Badge tone={r.status === "ENVOYEE" ? "pink" : "yellow"}>{r.status === "ENVOYEE" ? "Nouvelle" : "Contactée"}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-border pt-4">
                {r.status === "ENVOYEE" && <form action={markContacted.bind(null, r.id)}><SubmitButton size="sm" variant="secondary" pendingLabel="…">Contactée</SubmitButton></form>}
                <form action={markSigned.bind(null, r.id)} className="flex items-end gap-2">
                  <label className="text-xs text-text">Client créé<Select name="referredClientId" defaultValue="" className="mt-1 py-2 text-sm"><option value="">Pas encore</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></label>
                  <SubmitButton size="sm" pendingLabel="…">Signé 🎁</SubmitButton>
                </form>
                <form action={closeReferral.bind(null, r.id)} className="ml-auto"><SubmitButton size="sm" variant="ghost" pendingLabel="…">Sans suite</SubmitButton></form>
              </div>
            </Card>
          ))}
        </div>
      )}
      {done.length > 0 && (
        <>
          <SectionTitle emoji="🎁">Signées</SectionTitle>
          <div className="grid gap-2">
            {done.map((r) => (
              <Card key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div><p className="font-medium text-title">{r.contactName}{r.referred ? ` → ${r.referred.name}` : ""}</p><p className="text-xs text-text">par {r.referrer.name} · {r.rewardLabel}</p></div>
                <Badge tone="green">Récompense validée</Badge>
              </Card>
            ))}
          </div>
        </>
      )}
    </AdminPage>
  );
}
