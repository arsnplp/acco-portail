import Link from "next/link";
import { NewspaperIcon } from "lucide-react";
import { requireTeam } from "@/lib/auth";
import { whereSitesPour } from "@/lib/perimetre";
import { AdminPage } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { LogoClient } from "@/components/ui/logo-client";
import { etatBlog, fmtLundi, problemeBlog, sitesAvecBlog } from "@/lib/blog";
import { teamName } from "@/lib/crm";
import { prisma } from "@/lib/prisma";
import { PromptBlog } from "./prompt";

export const metadata = { title: "Blogs" };

/** Espace Blogs : les sites qui ont une offre de contenu, un article par lundi, alertes si le dernier lundi n'a rien eu. */
export default async function BlogPage() {
  const me = await requireTeam();
  const tous = await sitesAvecBlog();
  const perimetre = whereSitesPour(me);
  const autorises = Object.keys(perimetre).length ? new Set((await prisma.site.findMany({ where: perimetre, select: { id: true } })).map((s) => s.id)) : null;
  const sites = autorises ? tous.filter((s) => autorises.has(s.id)) : tous;
  const etats = await Promise.all(sites.map(async (s) => ({ s, e: await etatBlog(s.id), pb: await problemeBlog(s.id) })));
  const retard = etats.filter((x) => x.e.enRetard).length;
  return (
    <AdminPage title="Blogs" wide>
      <p className="-mt-3 mb-4 text-sm text-text">Un article par lundi et par site, jamais de doublon. {sites.length} site{sites.length > 1 ? "s" : ""} avec une offre de contenu{retard ? <> · <span className="font-semibold text-pink">{retard} sans article le {fmtLundi(etats[0].e.dernierLundi)}</span></> : ""}.</p>
      {sites.length === 0 ? <Empty icon={NewspaperIcon} title="Aucun site avec blog" text="Un site apparaît ici quand son client a souscrit une offre de contenu (blog, articles, SEO)." /> : (
        <div className="grid gap-2">
          {etats.map(({ s, e, pb }) => (
            <Card key={s.id} href={`/admin/blog/${s.id}`} className={`py-3 ${e.enRetard ? "border-pink/60" : ""}`}>
              <div className="flex flex-wrap items-center gap-3">
                <LogoClient id={s.client.id} name={s.client.name} logo={s.client.logoMiniPath} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-title">{s.name} <span className="text-xs font-normal text-text">· {s.client.name} · {s.developpeur ? teamName(s.developpeur) : "sans développeur"}{s.blogAuto ? " · automatique" : ""}</span></p>
                  <p className="text-xs text-text">{e.enRetard ? <span className="font-semibold text-pink">Rien publié le {fmtLundi(e.dernierLundi)}</span> : <span className="text-green">Dernier lundi : publié</span>} · prochain lundi ({fmtLundi(e.prochainLundi)}) : {e.prochain ? <span className="text-title">{e.prochain.titre}{e.prochain.statut === "PUBLIE" ? " (publié)" : ""}</span> : <span className="text-yellow">rien de prévu</span>}{pb ? <span className="text-pink"> · problème : {pb}</span> : ""}</p>
                </div>
                <div className="flex gap-1">{e.demandes.length > 0 && <Badge tone="neutral">{e.demandes.length} demandé{e.demandes.length > 1 ? "s" : ""}</Badge>}{e.rediges.length > 0 && <Badge tone="blue">{e.rediges.length} rédigé{e.rediges.length > 1 ? "s" : ""}</Badge>}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <div className="mt-6"><PromptBlog /></div>
      <p className="mt-4 text-xs text-muted">La rédaction et les sujets proposés passent par l’IA (interrupteur « Articles de blog » dans IA et intégrations). <Link href="/admin/parametres" className="underline">Paramètres</Link></p>
    </AdminPage>
  );
}
