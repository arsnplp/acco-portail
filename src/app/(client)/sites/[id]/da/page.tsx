import { redirect } from "next/navigation";

/** La DA est consultée depuis le Studio (Mon univers de marque) : ancienne adresse redirigée. */
export default async function DaRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/studio/marque/${id}`);
}
