import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { market_id, handle, direction } = body;

    if (!market_id || !handle || !direction) {
      return NextResponse.json(
        { error: "Missing required fields: market_id, handle, direction" },
        { status: 400 },
      );
    }

    if (direction !== "yes" && direction !== "no") {
      return NextResponse.json(
        { error: "direction must be 'yes' or 'no'" },
        { status: 400 },
      );
    }

    // For now, return success — tracking will be wired to paste.trade's submit endpoint
    return NextResponse.json({
      success: true,
      message: `Tracking ${direction.toUpperCase()} position for @${handle} on market ${market_id}`,
      market_id,
      handle,
      direction,
    });
  } catch (err) {
    console.error("[api/events/track] Error:", err);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
