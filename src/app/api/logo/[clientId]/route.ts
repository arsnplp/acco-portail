import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { lireLogo } from "@/lib/logo";

/** Miniature du logo d'un client : équipe, ou membre du portail de ce client. Mise en cache par le navigateur (chargement différé dans les listes). */
export async function GET(req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  if (user.role === "CLIENT" && !user.memberships.some((m) => m.clientId === clientId)) return new NextResponse(null, { status: 403 });
  const mini = new URL(req.url).searchParams.get("mini") === "1";
  const logo = await lireLogo(clientId, mini);
  if (!logo) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(logo.bytes), { headers: { "Content-Type": logo.contentType, "Cache-Control": "private, max-age=86400, immutable" } });
}
