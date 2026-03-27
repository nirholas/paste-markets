/**
 * Quick diagnostic: test paste.trade API connectivity
 * Run with: npx tsx src/lib/diagnose.ts
 */

const BASE = "https://paste.trade";
const KEY = process.env["PASTE_TRADE_KEY"] ?? "";

async function test(label: string, url: string, headers?: Record<string, string>) {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    const preview = text.slice(0, 300);
    console.log(`\n[${label}] HTTP ${res.status} — ${text.length} bytes`);
    console.log(`  Preview: ${preview}`);
  } catch (err) {
    console.error(`\n[${label}] FAILED:`, err);
  }
}

async function main() {
  console.log("=== paste.trade API Diagnostic ===");
  console.log(`KEY: ${KEY ? KEY.slice(0, 15) + "..." : "NOT SET"}`);

  // 1. Health check (public)
  await test("health", `${BASE}/api/health`);

  // 2. Feed (public, no auth)
  await test("feed-global", `${BASE}/api/feed?sort=new&limit=3`);

  // 3. Feed with author filter (public)
  await test("feed-frankdegods", `${BASE}/api/feed?sort=new&limit=5&author=frankdegods`);

  // 4. Search with auth
  if (KEY) {
    await test("search-frankdegods", `${BASE}/api/search?author=frankdegods&top=30d&limit=5`, {
      Authorization: `Bearer ${KEY}`,
    });
  } else {
    console.log("\n[search] SKIPPED — no API key");
  }

  // 5. Leaderboard (public)
  await test("leaderboard", `${BASE}/api/leaderboard?window=30d&sort=avg_pnl&limit=5`);

  // 6. Stats (public)
  await test("stats", `${BASE}/api/stats`);

  console.log("\n=== Done ===");
}

main();
