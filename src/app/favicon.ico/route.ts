import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

let cached: Buffer | null = null;

export async function GET() {
  if (!cached) {
    cached = readFileSync(join(process.cwd(), "src/app/icon.svg"));
  }
  return new NextResponse(cached, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
