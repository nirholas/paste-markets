import type { Metadata } from "next";
import GlobePage from "./globe-client";

export const metadata: Metadata = {
  title: "Trade Globe — paste.markets",
  description: "Real-time 3D globe of CT trade calls. Watch callers connect to tickers worldwide.",
  openGraph: {
    title: "Trade Globe — paste.markets",
    description: "Real-time 3D globe of CT trade calls. Watch callers connect to tickers worldwide.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trade Globe — paste.markets",
  },
};

export default function Page() {
  return <GlobePage />;
}
