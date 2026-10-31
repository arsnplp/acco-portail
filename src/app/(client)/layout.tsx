import { requireClientContext } from "@/lib/auth";
import { initials } from "@/lib/auth";
import { Header } from "@/components/nav/header";
import { BottomNav, CLIENT_NAV } from "@/components/nav/bottom-nav";
import { prisma } from "@/lib/prisma";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, client } = await requireClientContext();
  const conv = await prisma.conversation.findUnique({ where: { clientId: client.id }, select: { id: true, clientReadAt: true } });
  const unread = conv
    ? await prisma.message.count({
        where: { conversationId: conv.id, author: { role: { not: "CLIENT" } }, createdAt: { gt: conv.clientReadAt ?? new Date(0) } },
      })
    : 0;

  return (
    <>
      <Header initials={initials(user)} avatarUrl={user.avatarUrl} />
      {children}
      <BottomNav items={CLIENT_NAV} badges={{ "/messages": unread }} />
    </>
  );
}
