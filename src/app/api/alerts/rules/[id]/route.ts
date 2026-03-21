import { NextRequest, NextResponse } from "next/server";
import type { AlertCondition, AlertChannel } from "@/lib/alert-rules";
import {
  getAlertRuleById,
  updateAlertRule,
  deleteAlertRule,
  toggleAlertRule,
} from "@/lib/db";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PATCH /api/alerts/rules/[id] — update or toggle a rule */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { userId, name, conditions, channels, enabled, action } = body as {
      userId?: string;
      name?: string;
      conditions?: AlertCondition[];
      channels?: AlertChannel[];
      enabled?: boolean;
      action?: "toggle";
    };

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Toggle shortcut
    if (action === "toggle") {
      const toggled = await toggleAlertRule(id, userId);
      if (!toggled) {
        return NextResponse.json({ error: "Rule not found" }, { status: 404 });
      }
      return NextResponse.json(toggled);
    }

    // Full update
    const existing = await getAlertRuleById(id);
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    const updated = {
      ...existing,
      name: name ?? existing.name,
      conditions: conditions ?? existing.conditions,
      channels: channels ?? existing.channels,
      enabled: enabled !== undefined ? enabled : existing.enabled,
    };

    const success = await updateAlertRule(updated);
    if (!success) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

/** DELETE /api/alerts/rules/[id]?user=handle — delete a rule */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const user = request.nextUrl.searchParams.get("user");

  if (!user) {
    return NextResponse.json({ error: "user parameter required" }, { status: 400 });
  }

  const deleted = await deleteAlertRule(id, user);
  if (!deleted) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
