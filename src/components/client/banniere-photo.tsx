/* eslint-disable @next/next/no-img-element */
/** Bandeau photo en tête de page (maquette V3) : photo sombre, dégradé, surtitre, titre, texte et index en bas à droite. */
export function BannierePhoto({ image, surtitre, titre, texte, index, couleur = "bg-green" }: { image: "home" | "visibility" | "accompagnement" | "season" | "journal"; surtitre: string; titre: React.ReactNode; texte: string; index: string; couleur?: string }) {
  return (
    <section className="relative mb-6 flex min-h-[260px] items-center overflow-hidden rounded-[22px] border border-white/10 bg-[#09090b] text-white [isolation:isolate]">
      <img src={`/bannieres/${image}.jpg`} alt="" aria-hidden className="absolute inset-0 -z-20 size-full object-cover object-[58%_48%]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(2,3,7,.95)_0%,rgba(2,3,7,.66)_67%,rgba(2,3,7,.2)_100%)]" aria-hidden />
      <div className="relative max-w-[90%] px-6 py-7">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[2px] text-[#cacbd2]"><span className={`size-2 rounded-full ${couleur}`} /> {surtitre}</p>
        <h1 className="my-3 text-[37px] font-bold leading-[1.09] tracking-[-0.025em] text-white">{titre}</h1>
        <p className="max-w-[410px] text-[13px] leading-relaxed text-[#d3d4da]">{texte}</p>
      </div>
      <span className="absolute bottom-3 right-4 flex items-center gap-2 text-[10px] uppercase tracking-[2px] text-[#d0d2d8]"><span className={`size-1.5 rounded-full ${couleur}`} /> {index}</span>
    </section>
  );
}
