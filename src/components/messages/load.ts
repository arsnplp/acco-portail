import { prisma } from "@/lib/prisma";
import { signedUrl } from "@/lib/storage";

export type Attachment = { storagePath: string; fileName: string; mimeType?: string; url?: string | null };

export async function loadThread(conversationId: string) {
  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { author: { select: { id: true, firstName: true, avatarUrl: true, role: true, email: true } }, site: { select: { name: true } } },
  });
  return Promise.all(
    rows.map(async (m) => {
      const atts = (Array.isArray(m.attachments) ? (m.attachments as Attachment[]) : []);
      const withUrls = await Promise.all(atts.map(async (a) => ({ ...a, url: await signedUrl("messages", a.storagePath) })));
      return { id: m.id, body: m.body, createdAt: m.createdAt, author: m.author, siteName: m.site?.name ?? null, attachments: withUrls };
    }),
  );
}

export type ThreadMessage = Awaited<ReturnType<typeof loadThread>>[number];
