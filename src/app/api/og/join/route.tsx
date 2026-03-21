import { ImageResponse } from "@vercel/og";
import { getWaitlistCount } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const total = await getWaitlistCount();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0a0a1a",
          fontFamily: "monospace",
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: "#f0f0f0",
            marginBottom: 16,
          }}
        >
          paste.markets
        </div>
        <div
          style={{
            fontSize: 24,
            color: "#c8c8d0",
            marginBottom: 40,
          }}
        >
          Paste a source. AI finds the trade. P&L tracks from there.
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: "#2ecc71",
          }}
        >
          {total.toLocaleString()} traders waiting
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
