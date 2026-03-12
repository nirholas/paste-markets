/**
 * Preflight check for /trade runs.
 *
 * Runs before every /trade invocation. Checks environment for required and
 * optional keys, provisions PASTE_TRADE_KEY if missing, and reports status.
 *
 * Returns JSON:
 *   status: "ready" (all required keys present) or "onboarding" (first run)
 *   env_path: recommended .env file path for saving new keys
 *   keys: { [name]: { status, required, hint? } }
 *   handle?: paste.trade handle (if key exists or was provisioned)
 *   profile_url?: paste.trade profile URL
 *
 * Usage:
 *   bun run scripts/onboard.ts
 */

import { loadKey, getBaseUrl, saveKeyToEnv } from "./ensure-key";
import { getPreferredEnvWritePath, readEnvValue } from "./runtime-paths";
import { execSync } from "child_process";

interface KeyStatus {
  status: "found" | "provisioned" | "missing" | "failed";
  required: boolean;
  hint?: string;
}

/**
 * Provision a new PASTE_TRADE_KEY and return the handle from the API response.
 * ensureKey() logs the handle to stderr but doesn't return it, so we inline
 * the provisioning call here to capture the full response.
 */
async function provisionKey(): Promise<{ key: string; handle: string } | null> {
  const baseUrl = getBaseUrl();
  console.error("[paste.trade] No API key found. Creating your identity...");
  try {
    const res = await fetch(`${baseUrl}/api/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[paste.trade] Failed to create key (${res.status}): ${errText}`);
      return null;
    }
    const result = (await res.json()) as { api_key: string; user_id: string; handle: string };
    return { key: result.api_key, handle: result.handle };
  } catch (err) {
    console.error("[paste.trade] Network error creating key:", (err as Error).message);
    return null;
  }
}

async function run() {
  const keys: Record<string, KeyStatus> = {};
  let handle: string | null = null;
  let isOnboarding = false;

  // ── PASTE_TRADE_KEY (required, auto-provisioned) ──────────────────

  const existingKey = loadKey("PASTE_TRADE_KEY");
  if (existingKey) {
    keys.PASTE_TRADE_KEY = { status: "found", required: true };
  } else {
    isOnboarding = true;
    const provisioned = await provisionKey();
    if (provisioned) {
      keys.PASTE_TRADE_KEY = { status: "provisioned", required: true };
      handle = provisioned.handle;

      // Save key to .env and set for current process (same as ensureKey)
      saveKeyToEnv(provisioned.key);
      process.env.PASTE_TRADE_KEY = provisioned.key;

      const baseUrl = getBaseUrl();
      console.error(`[paste.trade] You are @${handle} · ${baseUrl.replace(/^https?:\/\//, "")}/u/${handle}`);
    } else {
      keys.PASTE_TRADE_KEY = {
        status: "failed",
        required: true,
        hint: "Auto-provisioning failed. Check your network connection to paste.trade and retry.",
      };
    }
  }

  // ── X_BEARER_TOKEN (optional) ─────────────────────────────────────

  if (readEnvValue("X_BEARER_TOKEN")) {
    keys.X_BEARER_TOKEN = { status: "found", required: false };
  } else {
    keys.X_BEARER_TOKEN = {
      status: "missing",
      required: false,
      hint: "Improves tweet extraction reliability. Get one at developer.x.com (pay-per-use, no monthly fee).",
    };
  }

  // ── GEMINI_API_KEY (optional) ─────────────────────────────────────

  if (readEnvValue("GEMINI_API_KEY")) {
    keys.GEMINI_API_KEY = { status: "found", required: false };
  } else {
    keys.GEMINI_API_KEY = {
      status: "missing",
      required: false,
      hint: "Enables speaker attribution in podcast and video trades. Get one at aistudio.google.com (free tier available).",
    };
  }

  // ── yt-dlp binary (optional) ──────────────────────────────────────

  let ytDlpInstalled = false;
  try {
    execSync("command -v yt-dlp", { stdio: "ignore" });
    ytDlpInstalled = true;
  } catch {
    // not installed
  }

  if (ytDlpInstalled) {
    keys.yt_dlp = { status: "found", required: false };
  } else {
    keys.yt_dlp = {
      status: "missing",
      required: false,
      hint: "Required for YouTube video/podcast extraction. Install via: brew install yt-dlp",
    };
  }

  // ── Output ────────────────────────────────────────────────────────

  const envPath = getPreferredEnvWritePath();
  const baseUrl = getBaseUrl();

  const result: Record<string, unknown> = {
    status: keys.PASTE_TRADE_KEY.status === "failed" ? "failed" : isOnboarding ? "onboarding" : "ready",
    env_path: envPath,
    keys,
  };

  if (handle) {
    result.handle = handle;
    result.profile_url = `${baseUrl}/u/${handle}`;
  }

  console.log(JSON.stringify(result, null, 2));
}

run().catch((err) => {
  console.error("[onboard] Fatal error:", (err as Error).message);
  process.exit(1);
});
