import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM ?? "Acco <contact@acco-lab.fr>";
const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Envoie un email via Resend. Sans clé (dev), on journalise seulement. */
export async function sendEmail(opts: { to: string; subject: string; html: string; text?: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email non envoyé — RESEND_API_KEY absente] à ${opts.to} : ${opts.subject}`);
    return { sent: false as const };
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text });
  if (error) {
    console.error("[email]", error);
    return { sent: false as const, error: error.message };
  }
  return { sent: true as const };
}

/** Gabarit commun : sobre, lisible sur téléphone. */
export function layout(title: string, bodyHtml: string, cta?: { label: string; href: string }) {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f4f5;font-family:Inter,Helvetica,Arial,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border:1px solid #e4e4e7;border-radius:12px"><tr><td style="padding:28px 28px 8px">
<img src="${APP}/brand/logo-acco.webp" alt="Acco" height="28" style="height:28px">
</td></tr><tr><td style="padding:8px 28px 0">
<h1 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#0e0e0f">${title}</h1>
<div style="font-size:15px;line-height:1.55;color:#3f3f46">${bodyHtml}</div>
${cta ? `<p style="margin:24px 0 8px"><a href="${cta.href}" style="display:inline-block;background:#0e0e0f;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${cta.label}</a></p>` : ""}
</td></tr><tr><td style="padding:16px 28px 24px;font-size:12px;color:#a1a1aa">Acco · agence web, Paris · <a href="${APP}/compte" style="color:#a1a1aa">Gérer mes notifications</a></td></tr></table>
</td></tr></table></body></html>`;
}

export const appUrl = (path: string) => `${APP}${path}`;
