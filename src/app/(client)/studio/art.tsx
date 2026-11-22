/** Visuels décoratifs du Studio (comme la maquette) : marque, création, bibliothèque, stratégie, et déclinaisons services. */
export type ArtKind = "brand" | "create" | "library" | "strategy" | "photo" | "print" | "social";
const FOND: Record<ArtKind, string> = { brand: "bg-[#edb600] text-[#101010]", create: "bg-[#141418] text-white", library: "bg-[#173d2b] text-white", strategy: "bg-[#e6e4e1] text-[#111]", photo: "bg-[#d8d3c5] text-[#151515]", print: "bg-[#dedfee] text-[#111]", social: "bg-[#f14a4e] text-[#111]" };

export function Art({ kind, label, className = "" }: { kind: ArtKind; label?: string; className?: string }) {
  return (
    <div className={`relative flex h-36 items-center justify-center overflow-hidden rounded-xl ${FOND[kind]} ${className}`} aria-hidden>
      {kind === "brand" && <span className="-rotate-6 text-7xl font-extrabold tracking-[-0.1em]">Aa.</span>}
      {(kind === "create" || kind === "print") && (
        <div className="flex">
          <span className="flex h-28 w-20 -rotate-12 flex-col justify-between rounded-sm bg-[#f4f1e8] p-3 font-serif text-base font-bold leading-tight text-[#171717] shadow-xl">Votre<br />marque.<small className="font-sans text-[8px] tracking-widest">STUDIO / 01</small></span>
          <span className="-ml-2 flex h-28 w-20 rotate-6 flex-col justify-between rounded-sm bg-[#cfad59] p-3 font-serif text-base font-bold leading-tight text-[#171717] shadow-xl">L’art<br />d’offrir.<small className="font-sans text-[8px] tracking-widest">COLLECTION</small></span>
        </div>
      )}
      {(kind === "library" || kind === "photo") && (
        <div className="flex">
          <span className="h-24 w-20 -rotate-12 border-4 border-white bg-[linear-gradient(145deg,#949d7e_0_40%,#514e3f_41%_56%,#d6d2c7_57%)] shadow-xl" />
          <span className="-ml-2 h-24 w-20 rotate-6 border-4 border-white bg-[linear-gradient(134deg,#d8c3aa,#4c5c46)] shadow-xl" />
          <span className="-ml-2 h-24 w-20 -rotate-3 border-4 border-white bg-[linear-gradient(36deg,#494d39_42%,#c6bba6_43%_64%,#737b63_65%)] shadow-xl" />
        </div>
      )}
      {kind === "strategy" && <span className="relative flex size-28 items-center justify-center rounded-full border border-current text-3xl font-bold after:absolute after:inset-3 after:rounded-full after:border after:border-current">↗</span>}
      {kind === "social" && <span className="text-5xl font-bold tracking-tight">Social.</span>}
      {label && <span className="absolute bottom-2 left-3 text-[9px] uppercase tracking-[2px] opacity-70">{label}</span>}
    </div>
  );
}
