import { NextResponse } from "next/server";

// Wallet session management requires server-side session storage (e.g. iron-session, next-auth).
// This endpoint is not yet implemented.
export async function POST() {
  return NextResponse.json(
    { error: "Wallet connection sessions are not yet implemented." },
    { status: 501 },
  );
}
