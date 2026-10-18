/**
 * Couche d'abstraction « avis Google ».
 * - GoogleBusinessProvider : API Business Profile (v4 reviews), via le compte Google connecté.
 * - DemoProvider : avis simulés stables, tant que Google n'a pas validé l'accès à l'API.
 */
import { connectedGoogleClient } from "@/lib/google-oauth";

export type ExternalReview = {
  externalId: string;
  authorName: string;
  authorPhotoUrl?: string | null;
  rating: number;
  text: string | null;
  publishedAt: Date;
  reply: string | null;
  repliedAt: Date | null;
};
export type ReviewsPage = { reviews: ExternalReview[]; averageRating: number | null; totalReviewCount: number | null };
export type Location = { id: string; title: string; address?: string };

export interface ReviewsProvider {
  readonly mode: "google" | "demo";
  listLocations(): Promise<Location[]>;
  fetchReviews(locationId: string): Promise<ReviewsPage>;
  reply(locationId: string, externalId: string, text: string): Promise<void>;
}

export const businessApiEnabled = () => process.env.GOOGLE_BUSINESS_API_ENABLED === "true";

const STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

class GoogleBusinessProvider implements ReviewsProvider {
  readonly mode = "google" as const;
  constructor(private client: NonNullable<Awaited<ReturnType<typeof connectedGoogleClient>>>) {}

  async listLocations() {
    const acc = await this.client.request<{ accounts?: { name: string }[] }>({ url: "https://mybusinessaccountmanagement.googleapis.com/v1/accounts" });
    const out: Location[] = [];
    for (const a of acc.data.accounts ?? []) {
      const res = await this.client.request<{ locations?: { name: string; title: string; storefrontAddress?: { locality?: string } }[] }>({
        url: `https://mybusinessbusinessinformation.googleapis.com/v1/${a.name}/locations?readMask=name,title,storefrontAddress&pageSize=100`,
      });
      for (const l of res.data.locations ?? []) out.push({ id: `${a.name}/${l.name}`, title: l.title, address: l.storefrontAddress?.locality });
    }
    return out;
  }

  async fetchReviews(locationId: string): Promise<ReviewsPage> {
    const reviews: ExternalReview[] = [];
    let pageToken: string | undefined;
    let averageRating: number | null = null, totalReviewCount: number | null = null;
    do {
      const res = await this.client.request<{
        reviews?: { reviewId: string; reviewer: { displayName: string; profilePhotoUrl?: string }; starRating: string; comment?: string; createTime: string; reviewReply?: { comment: string; updateTime: string } }[];
        averageRating?: number; totalReviewCount?: number; nextPageToken?: string;
      }>({ url: `https://mybusiness.googleapis.com/v4/${locationId}/reviews?pageSize=50${pageToken ? `&pageToken=${pageToken}` : ""}` });
      averageRating = res.data.averageRating ?? averageRating;
      totalReviewCount = res.data.totalReviewCount ?? totalReviewCount;
      for (const r of res.data.reviews ?? []) {
        reviews.push({
          externalId: r.reviewId, authorName: r.reviewer.displayName, authorPhotoUrl: r.reviewer.profilePhotoUrl ?? null,
          rating: STARS[r.starRating] ?? 0, text: r.comment ?? null, publishedAt: new Date(r.createTime),
          reply: r.reviewReply?.comment ?? null, repliedAt: r.reviewReply ? new Date(r.reviewReply.updateTime) : null,
        });
      }
      pageToken = res.data.nextPageToken;
    } while (pageToken && reviews.length < 300);
    return { reviews, averageRating, totalReviewCount };
  }

  async reply(locationId: string, externalId: string, text: string) {
    await this.client.request({ url: `https://mybusiness.googleapis.com/v4/${locationId}/reviews/${externalId}/reply`, method: "PUT", data: { comment: text } });
  }
}

const DEMO_REVIEWS: Array<[string, number, string | null, number]> = [
  ["Sophie M.", 5, "Accueil chaleureux et produits de qualité. Je recommande les yeux fermés !", 2],
  ["Karim B.", 4, "Très bien dans l’ensemble, un peu d’attente le samedi matin mais ça vaut le coup.", 6],
  ["Julie R.", 5, "Toujours un plaisir, l’équipe est adorable.", 12],
  ["Marc D.", 2, "Déçu cette fois-ci, commande incomplète et pas d’excuses.", 19],
  ["Nadia L.", 5, null, 27],
  ["Thomas P.", 5, "Le meilleur du quartier, tout simplement.", 41],
  ["Inès C.", 3, "Correct sans plus, les prix ont augmenté.", 58],
  ["Paul G.", 5, "Service impeccable, je reviendrai avec plaisir.", 75],
];

class DemoProvider implements ReviewsProvider {
  readonly mode = "demo" as const;
  private replies = new Map<string, string>();
  async listLocations() { return [{ id: "demo/location", title: "Fiche Google (démo)" }]; }
  async fetchReviews(locationId: string): Promise<ReviewsPage> {
    const reviews = DEMO_REVIEWS.map(([authorName, rating, text, daysAgo], i) => {
      const externalId = `demo-${locationId.slice(-6)}-${i}`;
      const reply = this.replies.get(externalId) ?? (i >= 4 ? "Merci beaucoup pour votre retour, à très bientôt !" : null);
      return { externalId, authorName, authorPhotoUrl: null, rating, text, publishedAt: new Date(Date.now() - daysAgo * 86400_000), reply, repliedAt: reply ? new Date(Date.now() - (daysAgo - 1) * 86400_000) : null };
    });
    return { reviews, averageRating: 4.4, totalReviewCount: 127 };
  }
  async reply(_locationId: string, externalId: string, text: string) { this.replies.set(externalId, text); }
}

const demo = new DemoProvider();

/** Fournisseur à utiliser : Google si l'API est validée et le compte connecté, sinon démo. */
export async function getReviewsProvider(): Promise<ReviewsProvider> {
  if (!businessApiEnabled()) return demo;
  const client = await connectedGoogleClient();
  return client ? new GoogleBusinessProvider(client) : demo;
}
