/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

/** Encart sombre « Studio ACCO » avec la planète (maquette V3) : de l'idée à la création. */
export function HeroStudio() {
  return (
    <section className="relative my-8 flex min-h-[230px] items-center overflow-hidden rounded-[22px] bg-[#0a0a0b] p-6 text-white [isolation:isolate]">
      <div aria-hidden className="absolute -right-12 top-0 size-[370px] -rotate-[20deg] rounded-full bg-[radial-gradient(circle_at_30%_22%,#dadce0_0%,#85858d_15%,#34343b_35%,#141417_57%,#09090a_70%)] shadow-[-12px_-14px_66px_#6b7eff33,inset_3px_4px_15px_#d4d7ff88] after:absolute after:inset-0 after:rounded-full after:bg-[repeating-radial-gradient(ellipse_at_32%_38%,transparent_0_8px,#ffffff0b_10px,#0000000d_13px,transparent_16px)]" />
      <div aria-hidden className="absolute -right-[85px] top-20 h-[140px] w-[500px] -rotate-[28deg] rounded-full border border-white/20" />
      <div className="relative z-10 max-w-[85%]">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2.4px] text-[#a9a9b4]"><span className="size-2 rounded-full bg-yellow" /> Studio ACCO</p>
        <h2 className="my-3 text-[34px] font-bold leading-[1.1] tracking-[-0.02em]">De l’idée à la création.</h2>
        <p className="max-w-[300px] text-sm leading-relaxed text-[#b5b5bf]">Des supports qui vous ressemblent, conçus dans votre univers de marque.</p>
        <Link href="/studio" className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#0a0a0b] transition-transform hover:-translate-y-px">Ouvrir le Studio →</Link>
      </div>
    </section>
  );
}

/** Carte « image + histoire » (maquette V3) : photo en haut, surtitre, titre, texte et lien. */
export function CarteImage({ image, surtitre, titre, texte, href, lien, couleur = "bg-blue", externe }: { image: "season" | "journal" | "home" | "visibility" | "accompagnement"; surtitre: string; titre: string; texte: string; href: string; lien: string; couleur?: string; externe?: boolean }) {
  const corps = (
    <>
      <img src={`/bannieres/${image}.jpg`} alt="" aria-hidden className="h-40 w-full object-cover" loading="lazy" />
      <div className="flex flex-1 flex-col items-start p-5">
        <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[2.4px] text-text"><span className={`size-2 rounded-full ${couleur}`} /> {surtitre}</p>
        <h3 className="mb-1.5 mt-3 text-xl font-bold leading-snug tracking-[-0.01em] text-title">{titre}</h3>
        <p className="text-sm text-text">{texte}</p>
        <span className="mt-4 border-b border-text pb-1 text-sm font-semibold text-title">{lien} ↗</span>
      </div>
    </>
  );
  const cls = "flex flex-col overflow-hidden rounded-card border border-border bg-surface transition-colors hover:border-text";
  return externe ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{corps}</a> : <Link href={href} className={cls}>{corps}</Link>;
}
