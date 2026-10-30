import Image from "next/image";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getTheme } from "@/lib/theme";

export async function Header({ initials, avatarUrl, accountHref = "/compte", right, width = "max-w-lg" }: { initials: string; avatarUrl?: string | null; accountHref?: string; right?: React.ReactNode; width?: string }) {
  const theme = await getTheme();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className={`mx-auto grid h-14 grid-cols-[1fr_auto_1fr] items-center px-4 ${width}`}>
        <Link href="/" aria-label="Accueil" className="flex w-fit items-center">
          <Image src="/brand/logo-acco.webp" alt="" width={28} height={28} priority className="size-7" />
        </Link>
        <Image src="/brand/acco-wordmark-600.png" alt="Acco" width={600} height={134} priority className="h-[22px] w-auto select-none" draggable={false} />
        <div className="flex items-center justify-end gap-2">
          {right}
          <ThemeToggle initial={theme} />
          <Link href={accountHref} aria-label={accountHref.startsWith("/admin") ? "Paramètres" : "Mon compte"} title={accountHref.startsWith("/admin") ? "Paramètres" : undefined}>
            <Avatar initials={initials} src={avatarUrl} />
          </Link>
        </div>
      </div>
    </header>
  );
}
