export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { joinWaitlist, getWaitlistCount } from "@/lib/db";

const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let handle = (body.handle ?? "").trim();
    const email = body.email?.trim() || undefined;
    const referredBy = body.referredBy?.trim() || undefined;

    // Strip leading @
    if (handle.startsWith("@")) handle = handle.slice(1);

    if (!handle || !HANDLE_RE.test(handle)) {
      return NextResponse.json(
        { error: "Invalid Twitter handle. Letters, numbers, and underscores only (max 15 chars)." },
        { status: 400 },
      );
    }

    // Basic email validation if provided
    if (email && !email.includes("@")) {
      return NextResponse.json(
        { error: "Invalid email address." },
        { status: 400 },
      );
    }

    const result = joinWaitlist(handle.toLowerCase(), email, referredBy);

    return NextResponse.json({
      handle,
      position: result.position,
      referralCode: result.referralCode,
      total: result.total,
      isExisting: result.isExisting,
    });
  } catch (err) {
    console.error("Waitlist join error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Try again." },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const total = getWaitlistCount();
    return NextResponse.json({ total });
  } catch {
    return NextResponse.json({ total: 0 });
  }
}
