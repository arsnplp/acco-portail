import Link from "next/link";
import { MessageCircleIcon } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { whereClientsPour } from "@/lib/perimetre";

type U = Parameters<typeof whereClientsPour>[0] & { id: string };

/** Messages non lus par l'équipe (écrits par des clients après la dernière lecture), sur le périmètre de l'utilisateur. */
export async function messagesNonLus(user: U) {
  const convs = await prisma.conversation.findMany({ where: { client: whereClientsPour(user) }, select: { id: true, teamReadAt: true } });
  if (convs.length === 0) return 0;
  const counts = await Promise.all(convs.map((c) => prisma.message.count({ where: { conversationId: c.id, author: { role: "CLIENT" }, createdAt: { gt: c.teamReadAt ?? new Date(0) } } })));
  return counts.reduce((a, b) => a + b, 0);
}

/** Signalements de la Direction adressés à l'utilisateur, pas encore lus ni traités. */
export const signalementsNonLus = (user: U) => prisma.signalement.count({ where: { versId: user.id, luAt: null, traiteAt: null } });

/** Icône Messages de l'en-tête (à côté du mode jour / nuit) : messages clients non lus + signalements de la Direction non lus. */
export async function MessagesIcon({ user }: { user: U }) {
  const [a, b] = await Promise.all([messagesNonLus(user), signalementsNonLus(user)]);
  const n = a + b;
  return (
    <Link href="/admin/messages" aria-label={n ? `Messages (${n} non lu${n > 1 ? "s" : ""})` : "Messages"} title="Messages"
      className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-text hover:border-text hover:text-title">
      <MessageCircleIcon size={16} />
      {n > 0 && <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink px-1 text-[10px] font-bold text-white">{n > 99 ? "99+" : n}</span>}
    </Link>
  );
}
