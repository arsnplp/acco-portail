import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Retour arrière / onglets instantanés : la page visitée reste en cache côté navigateur 30 s.
  // agentUpgrade: false → l'alerte de mise à jour Next.js n'interrompt plus `next build` (elle a cassé un déploiement).
  experimental: { staleTimes: { dynamic: 30, static: 180 }, agentUpgrade: false },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "yihzyaephrlbejhwyufs.supabase.co" }],
  },
};

export default nextConfig;
