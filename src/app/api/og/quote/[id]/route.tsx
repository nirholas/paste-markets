import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const WIDTH = 1200;
const HEIGHT = 630;

const BG = "#0a0a1a";
const SURFACE = "#0f0f22";
const BORDER = "#1a1a2e";
const TEXT = "#f0f0f0";
const MUTED = "#555568";
const GREEN = "#2ecc71";
const ACCENT = "#3b82f6";

async function loadFont(): Promise<ArrayBuffer> {
  const res = await fetch(new URL("/fonts/JetBrainsMono-Regular.ttf", baseUrl()));
  if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
  return res.arrayBuffer();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getTextSize(text: string): number {
  if (text.length > 200) return 20;
  if (text.length > 140) return 22;
  if (text.length > 80) return 26;
  return 28;
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
}

interface WallPostData {
  id: string;
  author_handle: string;
  author_display_name: string | null;
  author_avatar_url: string | null;
  content: string;
  posted_at: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch the wall post via the API (edge runtime can't access SQLite directly)
  const res = await fetch(`${baseUrl()}/api/wall/${encodeURIComponent(id)}`);
  if (!res.ok) {
    return new Response("Quote not found", { status: 404 });
  }
  const post: WallPostData = await res.json();

  const fontData = await loadFont();
  const fontSize = getTextSize(post.content);
  const handle = post.author_handle;
  const initial = handle[0]?.toUpperCase() ?? "?";

  const image = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: `${WIDTH}px`,
          height: `${HEIGHT}px`,
          fontFamily: "JetBrains Mono",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background gradient */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `linear-gradient(135deg, ${BG} 0%, ${SURFACE} 100%)`,
          }}
        />

        {/* Subtle grid overlay */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.03,
            backgroundImage:
              "repeating-linear-gradient(0deg, #ffffff 0px, #ffffff 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #ffffff 0px, #ffffff 1px, transparent 1px, transparent 40px)",
          }}
        />

        {/* Green accent left border */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            width: "4px",
            height: "100%",
            backgroundColor: GREEN,
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "56px 64px 40px 64px",
          }}
        >
          {/* Quote section */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
          >
            {/* Quote marks */}
            <div
              style={{
                display: "flex",
                fontSize: "72px",
                color: ACCENT,
                lineHeight: 0.8,
                marginBottom: "16px",
                fontWeight: 700,
              }}
            >
              &ldquo;
            </div>

            {/* Tweet text */}
            <div
              style={{
                display: "flex",
                fontSize: `${fontSize}px`,
                color: TEXT,
                lineHeight: 1.5,
                maxWidth: "960px",
                marginBottom: "24px",
              }}
            >
              {post.content}
            </div>

            {/* Closing quote */}
            <div
              style={{
                display: "flex",
                fontSize: "72px",
                color: ACCENT,
                lineHeight: 0.5,
                fontWeight: 700,
                justifyContent: "flex-end",
                maxWidth: "960px",
              }}
            >
              &rdquo;
            </div>
          </div>

          {/* Handle + timestamp */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "24px",
            }}
          >
            {/* Avatar */}
            {post.author_avatar_url ? (
              <img
                src={post.author_avatar_url}
                width={44}
                height={44}
                style={{
                  borderRadius: "22px",
                  border: `2px solid ${ACCENT}`,
                  marginRight: "14px",
                }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  width: "44px",
                  height: "44px",
                  borderRadius: "22px",
                  backgroundColor: BORDER,
                  border: `2px solid ${ACCENT}`,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: "14px",
                  fontSize: "18px",
                  color: ACCENT,
                  fontWeight: 700,
                }}
              >
                {initial}
              </div>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: "18px",
                  color: TEXT,
                  fontWeight: 700,
                }}
              >
                @{handle}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: "14px",
                  color: MUTED,
                }}
              >
                {formatDate(post.posted_at)}
              </div>
            </div>
          </div>

          {/* Brand bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `1px solid ${BORDER}`,
              paddingTop: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: "22px",
                  fontWeight: 700,
                  color: TEXT,
                }}
              >
                paste.markets
              </div>
              <div
                style={{
                  display: "flex",
                  width: "4px",
                  height: "4px",
                  borderRadius: "2px",
                  backgroundColor: MUTED,
                }}
              />
              <div
                style={{
                  display: "flex",
                  fontSize: "14px",
                  color: MUTED,
                }}
              >
                Real P&amp;L for Crypto Twitter
              </div>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "13px",
                color: GREEN,
                letterSpacing: "1px",
              }}
            >
              VERIFIED REACTIONS
            </div>
          </div>
        </div>

        {/* Subtle border glow */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            border: `1px solid ${BORDER}`,
            pointerEvents: "none",
          }}
        />
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        {
          name: "JetBrains Mono",
          data: fontData,
          style: "normal" as const,
          weight: 400 as const,
        },
      ],
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    }
  );

  return image;
}
