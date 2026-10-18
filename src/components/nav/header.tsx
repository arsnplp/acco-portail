import Image from "next/image";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";

export function Header({ initials, avatarUrl, accountHref = "/compte", right, width = "max-w-lg" }: { initials: string; avatarUrl?: string | null; accountHref?: string; right?: React.ReactNode; width?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className={`mx-auto flex h-14 items-center justify-between px-4 ${width}`}>
        <Link href="/" aria-label="Accueil">
          <Image src="/brand/logo-acco.webp" alt="Acco" width={96} height={30} priority className="h-7 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          {right}
          <Link href={accountHref} aria-label="Mon compte">
            <Avatar initials={initials} src={avatarUrl} />
          </Link>
        </div>
      </div>
    </header>
  );
}
