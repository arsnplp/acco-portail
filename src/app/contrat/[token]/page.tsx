import Image from "next/image";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CONTRAT_STATUT, chargerContrat, lienPdf, marquerConsulte } from "@/lib/contrats";
import { fmtDate } from "@/lib/format";
import { AcceptationForm } from "./form";

export const metadata = { title: "Votre contrat ACCO LAB" };

/** Page publique du lien sécurisé (00.5) : lecture du PDF exact, puis acceptation par code email, ou refus. */
export default async function ContratPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const h = await headers();
  const base = await marquerConsulte(token, h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, h.get("user-agent"));
  if (!base) notFound();
  const c = await chargerContrat(base.id);
  if (!c) notFound();
  const pdfUrl = await lienPdf(c.pdfPath);
  const societe = c.client?.name ?? c.prospect?.societe ?? "";
  const ouvert = c.statut === "ENVOYE" || c.statut === "CONSULTE";
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-10">
      <Image src="/brand/acco-wordmark-600.png" alt="ACCO LAB" width={600} height={134} className="brand-logo h-8 w-auto" priority />
      <h1 className="mt-8 text-2xl leading-tight">Contrat {c.reference}</h1>
      <p className="mt-2 text-sm text-text">{c.titre} · {societe}{c.commercial ? ` · votre interlocuteur : ${c.commercial.firstName ?? ""} ${c.commercial.lastName ?? ""}`.trimEnd() : ""}</p>
      <div className="mt-4 rounded-card border border-border bg-surface p-4 text-sm text-text-strong">
        <p>Engagement de {c.dureeMois} mois{c.debutEngagement ? ` à compter du ${fmtDate(c.debutEngagement)}` : ""}, reconduction tacite par périodes de {c.reconductionMois} mois, préavis {c.preavisJours} jours.</p>
        <p className="mt-1">Abonnement de {(c.montantMensuelHt / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} HT par mois{c.montantPonctuelHt ? ` et prestations ponctuelles de ${(c.montantPonctuelHt / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} HT` : ""}.</p>
        <ul className="mt-2 list-disc pl-5 text-text">{c.lignes.map((l) => <li key={l.id}>{l.libelle}{l.quantite > 1 ? ` × ${l.quantite}` : ""}</li>)}</ul>
      </div>
      {pdfUrl ? (
        <div className="mt-4">
          <iframe src={pdfUrl} title="Contrat" className="h-[60vh] w-full rounded-card border border-border bg-white" />
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-title underline">Télécharger le PDF</a>
        </div>
      ) : <p className="mt-4 text-sm text-pink">Le PDF n’est pas disponible. Contactez votre interlocuteur.</p>}
      <div className="mt-6">
        {ouvert && pdfUrl ? <AcceptationForm token={token} emailDefaut={c.signataireEmail} /> : (
          <p className="rounded-card border border-border bg-surface p-4 text-sm text-text">{c.statut === "SIGNE" ? `Ce contrat a été accepté le ${c.signeAt ? fmtDate(c.signeAt) : ""}.` : c.statut === "REFUSE" ? "Ce contrat a été refusé." : `Ce contrat n’est pas ouvert à l’acceptation (${CONTRAT_STATUT[c.statut].label.toLowerCase()}).`}</p>
        )}
      </div>
      <p className="mt-10 text-center text-xs text-muted">Lien personnel. <a href="/confidentialite" className="underline">Confidentialité</a> · acco-lab.fr</p>
    </main>
  );
}
