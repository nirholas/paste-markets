import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const MAX_RAW_ARG_CHARS = 65_536;
export const MAX_SESSION_KEY_CHARS = 512;
export const MAX_IDEMPOTENCY_KEY_CHARS = 256;
export const MAX_TARGET_CHARS = 256;
export const MAX_RUN_ID_CHARS = 64;
export const MAX_MESSAGE_CHARS = 24_000;
export const MAX_AUDIT_STRING_CHARS = 400;
export const MAX_CHILD_OUTPUT_CHARS = 280;
export const GATEWAY_CALL_TIMEOUT_MS = 20_000;
export const GATEWAY_CALL_MAX_ATTEMPTS = 3;
export const GATEWAY_CALL_RETRY_DELAY_MS = 1_200;
const KNOWN_MESSAGE_CHANNELS = new Set([
  "telegram",
  "whatsapp",
  "discord",
  "signal",
  "imessage",
  "slack",
  "sms",
  "email",
]);

export const DEFAULT_AUDIT_LOG_PATH = path.join(
  os.homedir(),
  ".openclaw",
  "logs",
  "trade-slash-wrapper.audit.log",
);

export function hashForAudit(value) {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16);
}

export function sanitizeAuditString(value) {
  return String(value)
    .replace(/\0/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, MAX_AUDIT_STRING_CHARS);
}

function summarizeChildOutput(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = sanitizeAuditString(value);
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, MAX_CHILD_OUTPUT_CHARS);
}

function sleepMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return;
  }
  const buffer = new SharedArrayBuffer(4);
  const view = new Int32Array(buffer);
  Atomics.wait(view, 0, 0, ms);
}

function shouldRetryGatewayCall(result) {
  if (!result || result.status === 0) {
    return false;
  }
  const combined = [
    result.error ? String(result.error.message || result.error) : "",
    typeof result.stderr === "string" ? result.stderr : "",
    typeof result.stdout === "string" ? result.stdout : "",
  ]
    .join("\n")
    .toLowerCase();

  return (
    combined.includes("gateway timeout") ||
    combined.includes("closed before connect") ||
    combined.includes("econnrefused") ||
    combined.includes("connection refused") ||
    combined.includes("econnreset")
  );
}

function assertNoNullBytes(value, fieldName) {
  if (value.includes("\0")) {
    throw new Error(`${fieldName} contains null bytes`);
  }
}

function assertBoundedString(value, fieldName, maxChars) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
  if (!value.trim()) {
    throw new Error(`${fieldName} is required`);
  }
  if (value.length > maxChars) {
    throw new Error(`${fieldName} is too long (${value.length}). Max ${maxChars}.`);
  }
  assertNoNullBytes(value, fieldName);
  return value.trim();
}

export function parseWrapperPayload(rawArg) {
  if (typeof rawArg !== "string" || !rawArg) {
    throw new Error("missing payload");
  }
  if (rawArg.length > MAX_RAW_ARG_CHARS) {
    throw new Error(`payload arg too large (${rawArg.length}). Max ${MAX_RAW_ARG_CHARS}.`);
  }
  assertNoNullBytes(rawArg, "payload");

  let parsed;
  try {
    parsed = JSON.parse(rawArg);
  } catch {
    throw new Error("payload is not valid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("payload must be a JSON object");
  }

  const sessionKey = assertBoundedString(parsed.sessionKey, "sessionKey", MAX_SESSION_KEY_CHARS);
  const idempotencyKey = assertBoundedString(
    parsed.idempotencyKey,
    "idempotencyKey",
    MAX_IDEMPOTENCY_KEY_CHARS,
  );
  const target =
    parsed.target === undefined || parsed.target === null
      ? null
      : assertBoundedString(parsed.target, "target", MAX_TARGET_CHARS);
  const runId =
    parsed.runId === undefined || parsed.runId === null
      ? null
      : assertBoundedString(parsed.runId, "runId", MAX_RUN_ID_CHARS);
  const message = assertBoundedString(parsed.message, "message", MAX_MESSAGE_CHARS);

  return { sessionKey, idempotencyKey, target, runId, message };
}

export function deriveMessageChannelFromSessionKey(sessionKey) {
  const normalized = typeof sessionKey === "string" ? sessionKey.trim().toLowerCase() : "";
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("agent:")) {
    const parts = normalized.split(":");
    const channel = parts[2] ?? "";
    return KNOWN_MESSAGE_CHANNELS.has(channel) ? channel : null;
  }

  const first = normalized.split(":")[0] ?? "";
  return KNOWN_MESSAGE_CHANNELS.has(first) ? first : null;
}

export function deriveTelegramTargetFromSessionKey(sessionKey) {
  const normalized = typeof sessionKey === "string" ? sessionKey.trim() : "";
  if (!normalized) {
    return null;
  }

  const directMatch = normalized.match(/^agent:[^:]+:telegram:direct:(.+)$/i);
  if (directMatch && directMatch[1].trim()) {
    return directMatch[1].trim();
  }

  const slashMatch = normalized.match(/^agent:[^:]+:telegram:slash:(.+)$/i);
  if (slashMatch && slashMatch[1].trim()) {
    return slashMatch[1].trim();
  }

  const rawDirect = normalized.match(/^telegram:direct:(.+)$/i);
  if (rawDirect && rawDirect[1].trim()) {
    return rawDirect[1].trim();
  }

  const rawSlash = normalized.match(/^telegram:slash:(.+)$/i);
  if (rawSlash && rawSlash[1].trim()) {
    return rawSlash[1].trim();
  }

  return null;
}

export function buildAgentCallParams(payload) {
  const params = {
    sessionKey: payload.sessionKey,
    message: payload.message,
    idempotencyKey: payload.idempotencyKey,
    deliver: true,
  };

  const channel = deriveMessageChannelFromSessionKey(payload.sessionKey);
  if (channel) {
    params.channel = channel;
  }
  const target =
    typeof payload.target === "string" && payload.target.trim()
      ? payload.target.trim()
      : deriveTelegramTargetFromSessionKey(payload.sessionKey);
  if (target) {
    params.to = target;
  }
  if (channel === "telegram" && !target) {
    throw new Error("telegram target could not be derived from sessionKey");
  }

  return JSON.stringify(params);
}

export function buildChatSendParams(payload) {
  return buildAgentCallParams(payload);
}

export function appendAuditEvent(event, opts = {}) {
  const auditLogPath = opts.auditLogPath ?? DEFAULT_AUDIT_LOG_PATH;
  const line = JSON.stringify(
    {
      ts: new Date().toISOString(),
      event,
    },
    (_key, value) => (typeof value === "string" ? sanitizeAuditString(value) : value),
  );

  mkdirSync(path.dirname(auditLogPath), { recursive: true });
  appendFileSync(auditLogPath, `${line}\n`, { encoding: "utf8", mode: 0o600 });
}

function summarizePayloadForAudit(payload) {
  return {
    sessionKeyHash: hashForAudit(payload.sessionKey),
    targetHash: payload.target ? hashForAudit(payload.target) : null,
    idempotencyKeyHash: hashForAudit(payload.idempotencyKey),
    runIdHash: payload.runId ? hashForAudit(payload.runId) : null,
    messageHash: hashForAudit(payload.message),
    messageLength: payload.message.length,
  };
}

export function runWrapper(rawArg, opts = {}) {
  const spawnSyncImpl = opts.spawnSyncImpl ?? spawnSync;
  const auditLogPath = opts.auditLogPath;

  let payload;
  try {
    payload = parseWrapperPayload(rawArg);
  } catch (error) {
    appendAuditEvent(
      {
        type: "trade_wrapper_invalid_payload",
        reason: error instanceof Error ? error.message : String(error),
      },
      { auditLogPath },
    );
    return 2;
  }

  const auditBase = summarizePayloadForAudit(payload);
  const channel = deriveMessageChannelFromSessionKey(payload.sessionKey);
  const target =
    typeof payload.target === "string" && payload.target.trim()
      ? payload.target.trim()
      : deriveTelegramTargetFromSessionKey(payload.sessionKey);
  const deliveryMeta = {
    channel: channel ?? null,
    targetHash: target ? hashForAudit(target) : auditBase.targetHash,
    targetPresent: Boolean(target),
    handoffMessageLength: payload.message.length,
  };
  let params;
  try {
    params = buildAgentCallParams(payload);
  } catch (error) {
    appendAuditEvent(
      {
        type: "trade_wrapper_handoff_preflight_failed",
        ...auditBase,
        ...deliveryMeta,
        reason: error instanceof Error ? error.message : String(error),
      },
      { auditLogPath },
    );
    return 1;
  }

  let result = null;
  for (let attempt = 1; attempt <= GATEWAY_CALL_MAX_ATTEMPTS; attempt++) {
    result = spawnSyncImpl(
      "openclaw",
      [
        "gateway",
        "call",
        "agent",
        "--json",
        "--timeout",
        String(GATEWAY_CALL_TIMEOUT_MS),
        "--params",
        params,
      ],
      {
        stdio: "pipe",
        encoding: "utf8",
        maxBuffer: 64 * 1024,
        timeout: GATEWAY_CALL_TIMEOUT_MS + 5_000,
        shell: false,
        windowsHide: true,
      },
    );
    if (!result.error && result.status === 0) {
      break;
    }
    if (attempt >= GATEWAY_CALL_MAX_ATTEMPTS || !shouldRetryGatewayCall(result)) {
      break;
    }
    appendAuditEvent(
      {
        type: "trade_wrapper_handoff_retry",
        ...auditBase,
        ...deliveryMeta,
        attempt,
        status: result.status ?? null,
        error: result.error ? String(result.error.message || result.error) : null,
        stderr: summarizeChildOutput(result.stderr),
        stdout: summarizeChildOutput(result.stdout),
      },
      { auditLogPath },
    );
    sleepMs(GATEWAY_CALL_RETRY_DELAY_MS * attempt);
  }

  if (!result || result.error || result.status !== 0) {
    appendAuditEvent(
      {
        type: "trade_wrapper_handoff_failed",
        ...auditBase,
        ...deliveryMeta,
        status: result.status ?? null,
        error: result.error ? String(result.error.message || result.error) : null,
        stderr: summarizeChildOutput(result.stderr),
        stdout: summarizeChildOutput(result.stdout),
      },
      { auditLogPath },
    );
    return 1;
  }

  appendAuditEvent(
    {
      type: "trade_wrapper_handoff_started",
      ...auditBase,
      ...deliveryMeta,
      status: result.status ?? 0,
    },
    { auditLogPath },
  );
  return 0;
}
