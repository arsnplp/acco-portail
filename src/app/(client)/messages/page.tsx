import { requireClientContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Page } from "@/components/page";
import { Chat } from "@/components/messages/chat";
import { AutoRefresh } from "@/components/messages/auto-refresh";
import { sendClientMessage } from "./actions";
import { loadThread } from "@/components/messages/load";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const { user, client } = await requireClientContext();
  const conv = await prisma.conversation.upsert({ where: { clientId: client.id }, create: { clientId: client.id }, update: { clientReadAt: new Date() } });
  const [messages, sites] = await Promise.all([
    loadThread(conv.id),
    prisma.site.findMany({ where: { clientId: client.id }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <Page title="Messages" subtitle="L’équipe Acco vous répond ici, généralement dans la journée." className="flex flex-col">
      <AutoRefresh seconds={20} />
      <Chat messages={messages} me={{ id: user.id, firstName: user.firstName, role: "CLIENT" }} sites={sites} placeholder="Écrivez à l’équipe…" emptyText="Posez-nous une question, envoyez une photo, dites-nous tout." action={sendClientMessage} />
    </Page>
  );
}
