import { NextRequest, NextResponse } from "next/server";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/db";

export const dynamic = "force-dynamic";

/** POST /api/alerts/notifications/read — mark notifications as read */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, notificationId } = body as {
      userId?: string;
      notificationId?: string;
    };

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (notificationId) {
      await markNotificationRead(userId, notificationId);
    } else {
      await markAllNotificationsRead(userId);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
