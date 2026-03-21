/**
 * Webhook dispatch system.
 * Sends events to registered webhook URLs with HMAC-SHA256 signatures.
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

export interface WebhookEvent {
  type: string;
  data: unknown;
  timestamp: string;
}

/**
 * Dispatch an event to all registered webhooks that match the event type.
 * Sends POST requests with HMAC-SHA256 signature in X-Webhook-Signature header.
 */
export async function dispatchWebhookEvent(event: WebhookEvent): Promise<void> {
  const rows = await sql`
    SELECT id, url, secret, events FROM webhooks WHERE active = true
  `;

  const payload = JSON.stringify(event);

  for (const row of rows) {
    const events = row.events as string[];
    if (!events.includes("*") && !events.includes(event.type)) continue;

    try {
      const signature = await signPayload(payload, row.secret as string);

      await fetch(row.url as string, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": signature,
          "X-Webhook-Event": event.type,
          "X-Webhook-Id": row.id as string,
        },
        body: payload,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      console.error(`[webhook-dispatch] Failed to deliver to ${row.url}:`, err);
      // Record failure but don't block
      try {
        await sql`
          UPDATE webhooks SET last_error = ${String(err)}, last_error_at = NOW()
          WHERE id = ${row.id as string}
        `;
      } catch { /* non-critical */ }
    }
  }
}

/**
 * Create HMAC-SHA256 signature for a payload using the webhook secret.
 */
async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return "sha256=" + Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a random webhook secret.
 */
export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "whsec_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
