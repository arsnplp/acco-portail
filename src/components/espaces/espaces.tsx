import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

export type Espace = {
  href: string; name: string; text: string; image: string;
  /** Teinte de l'image, reprise par le halo et la pastille. */
  accent: string;
  stat?: { value: number; label: string };
};

/** Les grands espaces de l'équipe, chacun avec son illustration (public/espaces). */
export function Espaces({ items }: { items: Espace[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((e, i) => (
        <Link
          key={e.href}
          href={e.href}
          className="group relative flex flex-col overflow-hidden rounded-[22px] border border-border bg-surface transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-text"
          style={{ boxShadow: `0 30px 60px -40px ${e.accent}` }}
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-[4/5]">
            <Image
              src={e.image}
              alt=""
              fill
              sizes="(min-width: 640px) 380px, 92vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              priority={i < 2}
            />
            {e.stat && (
              <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                <span className="size-2 rounded-full" style={{ background: e.stat.value > 0 ? e.accent : "#7a7d85" }} />
                {e.stat.value > 0 ? `${e.stat.value} ${e.stat.label}` : "Tout est à jour"}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
            <div className="min-w-0">
              <p className="font-title text-xl font-extrabold text-title">{e.name}</p>
              <p className="mt-0.5 text-sm text-text">{e.text}</p>
            </div>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-text transition-colors group-hover:border-transparent group-hover:bg-[var(--a)] group-hover:text-white" style={{ ["--a" as string]: e.accent }}>
              <ArrowRightIcon size={17} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
