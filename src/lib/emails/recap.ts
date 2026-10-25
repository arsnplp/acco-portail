/**
 * Email du récap mensuel, aux couleurs d'Acco (mêmes valeurs que globals.css : fond #0e0e0f, cartes #1a1a1b…).
 * Tableaux et styles en ligne uniquement : c'est ce que Gmail, Outlook et Apple Mail affichent correctement.
 */
const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const C = {
  bg: "#0e0e0f", surface: "#1a1a1b", surface2: "#1e1e22", border: "#252729",
  title: "#ffffff", text: "#7a7d85", strong: "#c9cad0", muted: "#4b4e55",
  green: "#9fb6a3", pink: "#d46a6a", yellow: "#e3d59b", blue: "#6f839e",
};
const SANS = "Inter,'Helvetica Neue',Helvetica,Arial,sans-serif";
const TITLE = "Poppins,Inter,'Helvetica Neue',Helvetica,Arial,sans-serif";

export type RecapEmailData = {
  siteName: string;
  monthLabel: string; // « septembre 2026 »
  prevMonthLabel: string; // « août »
  clicks: number; prevClicks: number | null;
  impressions: number; prevImpressions: number | null;
  position: number; prevPosition: number | null;
  contactCount: number; reviewCount: number;
  topQueries: { query: string; clicks: number }[];
  summary: string;
  href: string; // lien absolu vers la page Résultats
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n: number, d = 0) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/ /g, "&nbsp;");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Variation en pastille : verte si c'est mieux, rouge si c'est moins bien (pour la position, plus bas = mieux). */
function delta(cur: number, prev: number | null, prevLabel: string, lowerIsBetter = false) {
  if (prev === null || prev === 0) return "";
  const diff = lowerIsBetter ? prev - cur : cur - prev;
  const better = diff > 0, same = Math.abs(lowerIsBetter ? diff : (diff / prev) * 100) < (lowerIsBetter ? 0.1 : 1);
  const color = same ? C.text : better ? C.green : C.pink;
  const arrow = same ? "=" : better ? "&#9650;" : "&#9660;";
  const value = lowerIsBetter
    ? `${fmt(Math.abs(cur - prev), 1)} place${Math.abs(cur - prev) >= 2 ? "s" : ""}`
    : `${fmt(Math.abs(Math.round(((cur - prev) / prev) * 100)))}&nbsp;%`;
  return `<span style="display:inline-block;padding:3px 9px;border-radius:999px;border:1px solid ${color};color:${color};font-size:12px;font-weight:600;white-space:nowrap">${arrow} ${same ? "stable" : value} <span style="color:${C.text};font-weight:400">vs ${esc(prevLabel)}</span></span>`;
}

function tile(value: string, label: string, extra = "") {
  return `<td width="50%" valign="top" style="padding:6px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface2};border:1px solid ${C.border};border-radius:12px"><tr><td style="padding:16px">
    <div style="font-family:${TITLE};font-size:24px;line-height:1.1;font-weight:700;color:${C.title}">${value}</div>
    <div style="margin-top:4px;font-size:12px;color:${C.text}">${label}</div>
    ${extra ? `<div style="margin-top:8px">${extra}</div>` : ""}
  </td></tr></table></td>`;
}

/** Barre de progression en tableau (les div à largeur en % ne s'affichent pas dans Outlook sur PC). */
function bar(pct: number) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:4px;background:${C.border}" bgcolor="${C.border}"><tr>
    <td width="${pct}%" height="4" bgcolor="${C.blue}" style="height:4px;line-height:4px;font-size:0;border-radius:4px;background:${C.blue}">&nbsp;</td>${pct < 100 ? `<td height="4" style="height:4px;line-height:4px;font-size:0">&nbsp;</td>` : ""}
  </tr></table>`;
}

export function recapEmail(d: RecapEmailData) {
  const subject = `${d.siteName} : votre mois de ${d.monthLabel}`;
  const queries = d.topQueries.filter((q) => q.query).slice(0, 5);
  const maxQ = Math.max(1, ...queries.map((q) => q.clicks));
  const preheader = `${fmt(d.clicks)} visites depuis Google, ${d.contactCount} demande${d.contactCount > 1 ? "s" : ""} de clients.`;

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${esc(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Poppins:wght@600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:${SANS};color:${C.strong}" bgcolor="${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.bg}" style="background:${C.bg}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">

  <tr><td style="padding:0 8px 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><img src="${APP}/brand/acco-wordmark-600.png" alt="Acco" height="22" style="height:22px;display:block;border:0"></td>
      <td align="right" style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${C.text}">Récap mensuel</td>
    </tr></table>
  </td></tr>

  <tr><td bgcolor="${C.surface}" style="background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:28px 22px">
    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.text}">${esc(cap(d.monthLabel))} &middot; ${esc(d.siteName)}</div>
    <h1 style="margin:8px 0 22px;font-family:${TITLE};font-size:26px;line-height:1.2;font-weight:700;color:${C.title}">Votre mois en un coup d’œil</h1>

    <div style="font-family:${TITLE};font-size:56px;line-height:1;font-weight:700;color:${C.title}">${fmt(d.clicks)}</div>
    <div style="margin:6px 0 10px;font-size:15px;color:${C.strong}">visites depuis Google</div>
    ${delta(d.clicks, d.prevClicks, d.prevMonthLabel)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">
      <tr>
        ${tile(fmt(d.impressions), "apparitions dans Google", delta(d.impressions, d.prevImpressions, d.prevMonthLabel))}
        ${tile(d.position ? fmt(d.position, 1) : "–", "position moyenne dans Google", d.position ? delta(d.position, d.prevPosition, d.prevMonthLabel, true) : "")}
      </tr>
      <tr>
        ${tile(fmt(d.contactCount), `demande${d.contactCount > 1 ? "s" : ""} de clients via le site`)}
        ${tile(fmt(d.reviewCount), `nouvel${d.reviewCount > 1 ? "s" : ""} avis Google`)}
      </tr>
    </table>
  </td></tr>

  <tr><td style="height:14px;line-height:14px;font-size:0">&nbsp;</td></tr>

  <tr><td bgcolor="${C.surface}" style="background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:22px">
    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${C.yellow}">Le mot de votre agence</div>
    <p style="margin:10px 0 0;font-size:15px;line-height:1.6;color:${C.strong}">${esc(d.summary)}</p>
  </td></tr>

  ${queries.length ? `<tr><td style="height:14px;line-height:14px;font-size:0">&nbsp;</td></tr>
  <tr><td bgcolor="${C.surface}" style="background:${C.surface};border:1px solid ${C.border};border-radius:16px;padding:22px">
    <div style="font-family:${TITLE};font-size:17px;font-weight:600;color:${C.title}">Ce que les gens tapent pour vous trouver</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px">
      ${queries.map((q, i) => `<tr><td style="padding:10px 0;${i ? `border-top:1px solid ${C.border};` : ""}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td width="26" style="font-size:13px;color:${C.muted};font-weight:600">${i + 1}</td>
          <td style="font-size:14px;color:${C.strong}">${esc(q.query)}</td>
          <td align="right" style="font-size:13px;color:${C.text};white-space:nowrap">${fmt(q.clicks)} visite${q.clicks > 1 ? "s" : ""}</td>
        </tr><tr><td></td><td colspan="2" style="padding-top:6px">
          ${bar(Math.max(4, Math.round((q.clicks / maxQ) * 100)))}
        </td></tr></table>
      </td></tr>`).join("")}
    </table>
  </td></tr>` : ""}

  <tr><td align="center" style="padding:24px 8px 8px">
    <a href="${d.href}" style="display:inline-block;background:${C.title};color:${C.bg};text-decoration:none;font-weight:600;font-size:15px;padding:14px 24px;border-radius:12px">Voir tous mes résultats</a>
  </td></tr>

  <tr><td align="center" style="padding:18px 8px 0;font-size:12px;line-height:1.6;color:${C.muted}">
    Chiffres issus de Google Search Console pour ${esc(d.monthLabel)}.<br>
    Acco &middot; agence web &middot; <a href="${APP}/compte" style="color:${C.text}">Gérer mes notifications</a>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  const text = `${subject}\n\n${d.clicks} visites depuis Google\n${d.impressions} apparitions dans Google\nPosition moyenne : ${d.position}\n${d.contactCount} demande(s) de clients, ${d.reviewCount} nouvel(s) avis\n\n${d.summary}\n\n${queries.length ? `Ce que les gens tapent pour vous trouver :\n${queries.map((q, i) => `${i + 1}. ${q.query} (${q.clicks})`).join("\n")}\n\n` : ""}Voir tous mes résultats : ${d.href}`;
  return { subject, html, text };
}
