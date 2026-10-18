import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { AdminPage } from "@/components/admin/page";
import { MessageThread } from "@/components/messages/thread";
import { MessageComposer } from "@/components/messages/composer";
import { AutoRefresh } from "@/components/messages/auto-refresh";
import { loadThread } from "@/components/messages/load";
import { sendTeamMessage } from "../actions";

export default async function AdminThreadPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const admin = await requireAdmin();
  const client = await prisma.client.findUnique({ where: { id: clientId }, include: { sites: { select: { id: true, name: true } } } });
  if (!client) notFound();
  const conv = await prisma.conversation.upsert({ where: { clientId }, create: { clientId }, update: { teamReadAt: new Date() } });
  const messages = await loadThread(conv.id);
  const action = sendTeamMessage.bind(null, clientId);

  return (
    <AdminPage title={client.name} back={{ href: "/admin/messages", label: "Messages" }}>
      <AutoRefresh seconds={20} />
      <MessageThread messages={messages} meId={admin.id} teamSide emptyText="Commencez la conversation." />
      <MessageComposer action={action} sites={client.sites} placeholder={`Répondre à ${client.name}…`} offsetNav={false} />
    </AdminPage>
  );
}
