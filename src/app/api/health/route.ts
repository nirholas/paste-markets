import { NextResponse } from "next/server";
import { fetchHealth } from "@/lib/paste-trade";
import { TwitterHttpClient } from "@/lib/twitter-http-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [upstream, xAuth] = await Promise.all([
    fetchHealth(),
    new TwitterHttpClient().checkSession(),
  ]);

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    upstream: upstream ? { ok: upstream.ok, ts: upstream.ts } : { ok: false, error: "unreachable" },
    x_auth: {
      configured: xAuth.configured,
      session_valid: xAuth.sessionValid,
      ...((!xAuth.configured) && { hint: "Set TWITTER_AUTH_TOKEN and TWITTER_CT0 in .env.local" }),
      ...(xAuth.configured && !xAuth.sessionValid && { hint: "X session expired — refresh auth_token and ct0 cookies from x.com" }),
    },
  });
}
