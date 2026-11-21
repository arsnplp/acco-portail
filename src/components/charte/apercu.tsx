/* eslint-disable @next/next/no-img-element */
import { familleDe, type Charte } from "@/lib/charte";

/**
 * Aperçu « à quoi ça ressemble » : une mini page de site qui suit la charte (couleurs, polices, espacements, formes, mode).
 * Sans hook : utilisable côté client (mise à jour en direct dans le formulaire) et côté équipe (fiche client).
 */
export function ApercuCharte({ charte: c, nom, logoUrl, compact = false }: { charte: Charte; nom: string; logoUrl?: string | null; compact?: boolean }) {
  const sombre = c.mode === "sombre";
  const principale = c.couleurs.principale || "#2f6df6";
  const secondaire = c.couleurs.secondaire || (sombre ? "#1f232b" : "#eef1f6");
  const accent = c.couleurs.accent || principale;
  const fond = sombre ? "#15171c" : "#ffffff";
  const texte = sombre ? "#e8e9ee" : "#1c1e24";
  const texteDoux = sombre ? "#a2a6b3" : "#5d6270";
  const bordure = sombre ? "#2b2f38" : "#e4e7ee";
  const rayon = c.formes === "droit" ? 2 : c.formes === "arrondi" ? 14 : 8;
  const pad = c.densite === "aere" ? 22 : c.densite === "dense" ? 10 : 16;
  const gap = c.densite === "aere" ? 14 : c.densite === "dense" ? 6 : 10;
  const titres = familleDe(c.policeTitres || "sans");
  const textes = familleDe(c.policeTextes || "sans");
  const initiales = nom.split(/\s+/).map((m) => m[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div aria-hidden className="w-full overflow-hidden rounded-card border border-border" style={{ background: fond, color: texte, fontFamily: textes }}>
      {/* barre de navigation */}
      <div className="flex items-center justify-between" style={{ padding: `${pad * 0.6}px ${pad}px`, borderBottom: `1px solid ${bordure}` }}>
        <div className="flex items-center gap-2">
          {logoUrl ? <img src={logoUrl} alt="" className="object-contain" style={{ width: 28, height: 28, borderRadius: rayon / 2 }} /> : <span className="inline-flex items-center justify-center text-[11px] font-bold text-white" style={{ width: 28, height: 28, borderRadius: rayon / 2, background: principale }}>{initiales || "A"}</span>}
          <span className="text-sm font-semibold" style={{ fontFamily: titres }}>{nom}</span>
        </div>
        <div className="flex" style={{ gap }}>{["Accueil", "Services", "Contact"].map((m) => <span key={m} className="text-[11px]" style={{ color: texteDoux }}>{m}</span>)}</div>
      </div>
      {/* bandeau d'accueil */}
      <div style={{ padding: compact ? pad * 0.7 : pad, display: "grid", gap: compact ? gap * 0.6 : gap }}>
        <p className="leading-tight" style={{ fontFamily: titres, fontSize: compact ? 18 : c.densite === "dense" ? 20 : 24, fontWeight: 700 }}>Bienvenue chez {nom}</p>
        <p className="text-[12px] leading-snug" style={{ color: texteDoux }}>{c.mots ? c.mots : "Trois mots qui vous décrivent apparaîtront ici."}</p>
        <div className="flex flex-wrap" style={{ gap }}>
          <span className="text-[12px] font-semibold text-white" style={{ background: principale, borderRadius: rayon, padding: `${pad * 0.45}px ${pad * 0.9}px` }}>Prendre rendez-vous</span>
          <span className="text-[12px] font-semibold" style={{ border: `1.5px solid ${principale}`, color: principale, borderRadius: rayon, padding: `${pad * 0.45}px ${pad * 0.9}px` }}>En savoir plus</span>
        </div>
      </div>
      {/* trois cartes (masquées en version compacte, collée en haut du formulaire sur téléphone) */}
      {!compact && <div style={{ padding: `0 ${pad}px ${pad}px`, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap }}>
        {["Qualité", "Proximité", "Conseil"].map((t, i) => (
          <div key={t} style={{ background: secondaire, borderRadius: rayon, padding: pad * 0.7, display: "grid", gap: gap * 0.5 }}>
            {c.images === "minimal" ? null : <span style={{ display: "block", height: c.images === "illustrations" ? 18 : 26, borderRadius: rayon / 2, background: i === 1 ? accent : `${accent}55` }} />}
            <span className="text-[11px] font-semibold" style={{ fontFamily: titres }}>{t}</span>
            <span className="text-[10px] leading-snug" style={{ color: texteDoux }}>Un court texte ici.</span>
          </div>
        ))}
      </div>}
    </div>
  );
}
