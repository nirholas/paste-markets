import { NextRequest, NextResponse } from "next/server";
import { getUserAlerts, createAlert, deleteAlert, toggleAlert } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = request.nextUrl.searchParams.get("user");
  if (!user) {
    return NextResponse.json({ error: "user parameter required" }, { status: 400 });
  }

  const alerts = getUserAlerts(user);
  return NextResponse.json(alerts);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_handle, alert_type, target, threshold_pnl, channel } = body;

    if (!user_handle || !alert_type || !target) {
      return NextResponse.json(
        { error: "user_handle, alert_type, and target are required" },
        { status: 400 },
      );
    }

    if (!["caller", "ticker", "consensus"].includes(alert_type)) {
      return NextResponse.json(
        { error: "alert_type must be caller, ticker, or consensus" },
        { status: 400 },
      );
    }

    const alert = createAlert({
      user_handle,
      alert_type,
      target: target.replace(/^[@$]/, ""),
      threshold_pnl: threshold_pnl ?? null,
      channel: channel ?? "web",
    });

    return NextResponse.json(alert, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const user = request.nextUrl.searchParams.get("user");

  if (!id || !user) {
    return NextResponse.json({ error: "id and user parameters required" }, { status: 400 });
  }

  const deleted = deleteAlert(parseInt(id), user);
  if (!deleted) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, user_handle } = body;

    if (!id || !user_handle) {
      return NextResponse.json({ error: "id and user_handle required" }, { status: 400 });
    }

    const alert = toggleAlert(id, user_handle);
    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json(alert);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
