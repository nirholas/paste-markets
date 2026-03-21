import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join paste.markets",
  description:
    "Paste a source. AI finds the trade. P&L tracks from there.",
  openGraph: {
    title: "Join paste.markets",
    description:
      "Paste a source. AI finds the trade. P&L tracks from there.",
    images: [{ url: "/api/og/join", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Join paste.markets",
    description:
      "Paste a source. AI finds the trade. P&L tracks from there.",
    images: ["/api/og/join"],
  },
};

export default function JoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
