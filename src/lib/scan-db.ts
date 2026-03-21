/**
 * DB operations for bulk caller scan jobs and rate limiting.
 * Uses the shared Neon connection from db.ts.
 */

import { randomUUID } from "node:crypto";
import { sql } from "./db";

export interface ScanJob {
  id: string;
  handle: string;
  status: "queued" | "running" | "complete" | "failed";
  tweets_scanned: number;
  calls_found: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error: string | null;
  result_json: string | null;
}

export async function createScanJob(handle: string): Promise<string> {
  const id = randomUUID();
  await sql`INSERT INTO scan_jobs (id, handle) VALUES (${id}, ${handle})`;
  return id;
}

export async function getScanJob(id: string): Promise<ScanJob | undefined> {
  const rows = await sql`SELECT * FROM scan_jobs WHERE id = ${id}`;
  return (rows[0] as ScanJob) ?? undefined;
}

export async function getCachedScanForHandle(handle: string): Promise<ScanJob | undefined> {
  const rows = await sql`
    SELECT * FROM scan_jobs
    WHERE handle = ${handle}
      AND status IN ('queued', 'running', 'complete')
      AND created_at > (NOW() - INTERVAL '6 hours')::text
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return (rows[0] as ScanJob) ?? undefined;
}

export async function setJobRunning(id: string): Promise<void> {
  await sql`UPDATE scan_jobs SET status = 'running', updated_at = NOW()::text WHERE id = ${id}`;
}

export async function updateJobProgress(
  id: string,
  tweetsScanned: number,
  callsFound: number,
): Promise<void> {
  await sql`
    UPDATE scan_jobs
    SET tweets_scanned = ${tweetsScanned}, calls_found = ${callsFound}, updated_at = NOW()::text
    WHERE id = ${id}
  `;
}

export async function completeJob(id: string, result: unknown): Promise<void> {
  await sql`
    UPDATE scan_jobs
    SET status = 'complete', result_json = ${JSON.stringify(result)},
        completed_at = NOW()::text, updated_at = NOW()::text
    WHERE id = ${id}
  `;
}

export async function failJob(id: string, error: string): Promise<void> {
  await sql`
    UPDATE scan_jobs
    SET status = 'failed', error = ${error},
        completed_at = NOW()::text, updated_at = NOW()::text
    WHERE id = ${id}
  `;
}

export async function getRecentScans(): Promise<ScanJob[]> {
  const rows = await sql`
    SELECT * FROM scan_jobs
    WHERE status = 'complete'
    ORDER BY completed_at DESC
    LIMIT 10
  `;
  return rows as ScanJob[];
}

export async function checkRateLimit(ip: string): Promise<{ allowed: boolean; count: number }> {
  const rows = await sql`
    SELECT COUNT(*) AS count FROM scan_rate_limits
    WHERE ip = ${ip} AND created_at > (NOW() - INTERVAL '1 hour')::text
  `;
  const count = Number(rows[0]?.count ?? 0);
  return { allowed: count < 3, count };
}

export async function recordScanRequest(ip: string): Promise<void> {
  await sql`INSERT INTO scan_rate_limits (ip) VALUES (${ip})`;
}
