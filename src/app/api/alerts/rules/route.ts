import { NextRequest, NextResponse } from "next/server";
import { createRuleObject } from "@/lib/alert-rules";
import type { AlertCondition, AlertChannel } from "@/lib/alert-rules";
import {
  getAlertRulesByUser,
  insertAlertRule,
} from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/alerts/rules?user=handle — list user's alert rules */
export async function GET(request: NextRequest) {
  const user = request.nextUrl.searchParams.get("user");
  if (!user) {
    return NextResponse.json({ error: "user parameter required" }, { status: 400 });
  }

  const rules = getAlertRulesByUser(user);
  return NextResponse.json(rules);
}

/** POST /api/alerts/rules — create a new alert rule */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, conditions, channels } = body as {
      userId?: string;
      name?: string;
      conditions?: AlertCondition[];
      channels?: AlertChannel[];
    };

    if (!userId || !name || !conditions || !channels) {
      return NextResponse.json(
        { error: "userId, name, conditions, and channels are required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(conditions) || conditions.length === 0) {
      return NextResponse.json(
        { error: "At least one condition is required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(channels) || channels.length === 0) {
      return NextResponse.json(
        { error: "At least one channel is required" },
        { status: 400 },
      );
    }

    const rule = createRuleObject({ userId, name, conditions, channels });
    insertAlertRule(rule);

    return NextResponse.json(rule, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
