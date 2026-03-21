import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import Nav from "@/components/ui/nav";
import "./globals.css";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://paste.markets";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "paste.markets",
    template: "%s | paste.markets",
  },
  description:
    "Real P&L rankings for Crypto Twitter. See who's actually making money — verified trade data, win rates, and avg P&L for the top CT callers. Powered by paste.trade.",
  keywords: [
    "crypto twitter",
    "CT traders",
    "P&L leaderboard",
    "crypto callers",
    "trading performance",
    "paste.trade",
    "win rate",
    "solana traders",
    "defi traders",
  ],
  authors: [{ name: "paste.markets", url: BASE_URL }],
  creator: "paste.markets",
  publisher: "paste.markets",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BASE_URL,
    siteName: "paste.markets",
    title: "paste.markets — CT Trader Leaderboard",
    description: "Real P&L rankings for Crypto Twitter traders.",
    images: [{ url: "/api/og/home", width: 1200, height: 630, alt: "paste.markets leaderboard" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@pasteMarkets",
    creator: "@swarminged",
    title: "paste.markets — CT Trader Leaderboard",
    description: "Real P&L rankings for Crypto Twitter traders.",
    images: ["/api/og/home"],
  },
  alternates: {
    canonical: BASE_URL,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jetbrains.variable}>
      <body className="font-mono antialiased min-h-screen">
        <Nav />
        {children}
      </body>
    </html>
  );
}
