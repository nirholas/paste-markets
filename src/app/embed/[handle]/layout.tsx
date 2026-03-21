"use client";

import { useEffect } from "react";

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Hide nav and ticker when rendered as embed
    const nav = document.querySelector("nav");
    // Ticker is the first div child of body with the scrolling trades
    const ticker = document.querySelector("body > div > div.overflow-hidden");
    if (nav) (nav as HTMLElement).style.display = "none";
    if (ticker) (ticker as HTMLElement).style.display = "none";
    document.body.style.background = "transparent";
    document.body.style.minHeight = "auto";

    return () => {
      if (nav) (nav as HTMLElement).style.display = "";
      if (ticker) (ticker as HTMLElement).style.display = "";
      document.body.style.background = "";
      document.body.style.minHeight = "";
    };
  }, []);

  return <>{children}</>;
}
