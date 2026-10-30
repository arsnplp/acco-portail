import Image from "next/image";
import Link from "next/link";
import { requireTeam, initials } from "@/lib/auth";
import { Avatar } from "@/components/ui/avatar";
import { CrmBottomNav, CrmNav } from "./crm-nav";
import { Rappels } from "./rappels";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getTheme } from "@/lib/theme";

/** Espace Commercial (CRM) : séparé du reste de l'admin, ouvert à l'équipe (admins et commerciaux). */
export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const user = await requireTeam();
  const admin = user.role === "ADMIN";
  const theme = await getTheme();
  return (
    <div className="min-h-dvh bg-bg pb-[calc(var(--nav-h)+env(safe-area-inset-bottom)+16px)] sm:pb-10">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4">
          <Link href={admin ? "/admin" : "/crm"} aria-label={admin ? "Retour au tableau de bord" : "Accueil"} className="flex shrink-0 items-center gap-2">
            <Image src="/brand/logo-acco.webp" alt="" width={28} height={28} priority className="brand-logo size-7" />
            <span className="hidden font-title text-base font-semibold text-title sm:inline">Commercial</span>
          </Link>
          <CrmNav admin={admin} />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle initial={theme} />
            <Link href={admin ? "/admin/parametres" : "/crm/parametres"} aria-label="Paramètres"><Avatar initials={initials(user)} src={user.avatarUrl} size={32} /></Link>
          </div>
        </div>
      </header>
      {children}
      <CrmBottomNav admin={admin} />
      <Rappels />
    </div>
  );
}
