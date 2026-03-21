import { NextRequest, NextResponse } from "next/server";
import { getTriggeredAlerts } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = request.nextUrl.searchParams.get("user");
  if (!user) {
    return NextResponse.json({ error: "user parameter required" }, { status: 400 });
  }

  const feed = getTriggeredAlerts(user);
  return NextResponse.json(feed);
}
