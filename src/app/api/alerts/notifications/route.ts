import { NextRequest, NextResponse } from "next/server";
import {
  getUnreadNotifications,
  getNotificationsByUser,
  countUnreadNotifications,
} from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/alerts/notifications?user=handle — unread notifications */
export async function GET(request: NextRequest) {
  const user = request.nextUrl.searchParams.get("user");
  if (!user) {
    return NextResponse.json({ error: "user parameter required" }, { status: 400 });
  }

  const all = request.nextUrl.searchParams.get("all") === "1";
  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "50");

  const notifications = all
    ? getNotificationsByUser(user, limit)
    : getUnreadNotifications(user);
  const unreadCount = countUnreadNotifications(user);

  return NextResponse.json({ notifications, unreadCount });
}
