"use client";
/**
 * Composant React/Next.js de formulaire de contact Acco.
 * <AccoForm siteKey="..." turnstileSiteKey="..." />
 * Charger une fois le script Turnstile dans le layout :
 * <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
 */
import { useState } from "react";

const ENDPOINT = "https://app.acco-lab.fr/api/forms";

export function AccoForm({ siteKey, turnstileSiteKey, types = ["Demande de devis", "Prise de rendez-vous", "Question", "Autre"], className }: { siteKey: string; turnstileSiteKey?: string; types?: string[]; className?: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setStatus("sending");
    const data = new FormData(form);
    data.set("pageUrl", window.location.href);
    try {
      const res = await fetch(`${ENDPOINT}/${siteKey}`, { method: "POST", body: data });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (json.ok) { form.reset(); setStatus("ok"); } else { setError(json.error ?? "réessayez"); setStatus("error"); }
      (window as unknown as { turnstile?: { reset: () => void } }).turnstile?.reset();
    } catch {
      setError("connexion impossible"); setStatus("error");
    }
  }

  if (status === "ok") return <p className={className}>Merci ! Nous vous répondons très vite.</p>;

  return (
    <form onSubmit={onSubmit} className={className}>
      <label>Votre nom<input name="name" required autoComplete="name" /></label>
      <label>Téléphone<input name="phone" type="tel" autoComplete="tel" /></label>
      <label>Email<input name="email" type="email" autoComplete="email" /></label>
      <label>Objet<select name="type">{types.map((t) => <option key={t}>{t}</option>)}</select></label>
      <label>Votre message<textarea name="message" rows={5} required /></label>
      <div style={{ position: "absolute", left: -9999 }} aria-hidden><input name="website" tabIndex={-1} autoComplete="off" /></div>
      {turnstileSiteKey && <div className="cf-turnstile" data-sitekey={turnstileSiteKey} />}
      <button type="submit" disabled={status === "sending"}>{status === "sending" ? "Envoi…" : "Envoyer"}</button>
      {status === "error" && <p role="alert">Oups : {error}</p>}
    </form>
  );
}
