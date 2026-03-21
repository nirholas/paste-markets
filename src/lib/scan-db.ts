/**
 * DB operations for bulk caller scan jobs and rate limiting.
 * Uses the shared better-sqlite3 instance from db.ts.
 */

import { randomUUID } from "node:crypto";
import { db } from "./db";

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

const stmts = {
  insertJob: db.prepare<[string, string]>(
    "INSERT INTO scan_jobs (id, handle) VALUES (?, ?)",
  ),

  getJob: db.prepare<[string], ScanJob>(
    "SELECT * FROM scan_jobs WHERE id = ?",
  ),

  // Return a recent complete/running/queued job for this handle (within 6h cache window)
  getCachedJob: db.prepare<[string], ScanJob>(`
    SELECT * FROM scan_jobs
    WHERE handle = ?
      AND status IN ('queued', 'running', 'complete')
      AND created_at > datetime('now', '-6 hours')
    ORDER BY created_at DESC
    LIMIT 1
  `),

  setRunning: db.prepare(
    "UPDATE scan_jobs SET status = 'running', updated_at = datetime('now') WHERE id = ?",
  ),

  updateProgress: db.prepare(`
    UPDATE scan_jobs
    SET tweets_scanned = ?, calls_found = ?, updated_at = datetime('now')
    WHERE id = ?
  `),

  completeJob: db.prepare(`
    UPDATE scan_jobs
    SET status = 'complete', result_json = ?,
        completed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `),

  failJob: db.prepare(`
    UPDATE scan_jobs
    SET status = 'failed', error = ?,
        completed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `),

  getRecentComplete: db.prepare<[], ScanJob>(`
    SELECT * FROM scan_jobs
    WHERE status = 'complete'
    ORDER BY completed_at DESC
    LIMIT 10
  `),

  countRecentByIp: db.prepare<[string], { count: number }>(`
    SELECT COUNT(*) AS count FROM scan_rate_limits
    WHERE ip = ? AND created_at > datetime('now', '-1 hour')
  `),

  recordRequest: db.prepare(
    "INSERT INTO scan_rate_limits (ip) VALUES (?)",
  ),
};

export function createScanJob(handle: string): string {
  const id = randomUUID();
  stmts.insertJob.run(id, handle);
  return id;
}

export function getScanJob(id: string): ScanJob | undefined {
  return stmts.getJob.get(id) ?? undefined;
}

export function getCachedScanForHandle(handle: string): ScanJob | undefined {
  return stmts.getCachedJob.get(handle) ?? undefined;
}

export function setJobRunning(id: string): void {
  stmts.setRunning.run(id);
}

export function updateJobProgress(
  id: string,
  tweetsScanned: number,
  callsFound: number,
): void {
  stmts.updateProgress.run(tweetsScanned, callsFound, id);
}

export function completeJob(id: string, result: unknown): void {
  stmts.completeJob.run(JSON.stringify(result), id);
}

export function failJob(id: string, error: string): void {
  stmts.failJob.run(error, id);
}

export function getRecentScans(): ScanJob[] {
  return stmts.getRecentComplete.all();
}

export function checkRateLimit(ip: string): { allowed: boolean; count: number } {
  const row = stmts.countRecentByIp.get(ip);
  const count = row?.count ?? 0;
  return { allowed: count < 3, count };
}

export function recordScanRequest(ip: string): void {
  stmts.recordRequest.run(ip);
}
