import type { Metadata, Viewport } from "next";
import { getTheme } from "@/lib/theme";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/push/register-sw";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Acco", template: "%s · Acco" },
  description: "Votre espace client Acco : vos sites, vos demandes, vos résultats.",
  applicationName: "Acco",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Acco", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0e0e0f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Mode jour / nuit choisi par l'utilisateur (cookie posé par le bouton soleil / lune), appliqué dès le serveur : pas de flash.
  const theme = await getTheme();
  return (
    <html lang="fr" data-theme={theme} className={`${inter.variable} ${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
