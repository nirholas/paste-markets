/**
 * DB operations for backtest jobs.
 * Mirrors scan-db.ts pattern but with extended fields for backtest reporting.
 */

import { randomUUID } from "node:crypto";
import { db } from "./db";

export interface BacktestJob {
  id: string;
  handle: string;
  status: "queued" | "scanning" | "analyzing" | "complete" | "failed";
  phase: string;
  tweets_scanned: number;
  total_tweets: number;
  calls_found: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error: string | null;
  result_json: string | null;
}

const stmts = {
  insertJob: db.prepare<[string, string]>(
    "INSERT INTO backtest_jobs (id, handle) VALUES (?, ?)",
  ),

  getJob: db.prepare<[string], BacktestJob>(
    "SELECT * FROM backtest_jobs WHERE id = ?",
  ),

  getCachedJob: db.prepare<[string], BacktestJob>(`
    SELECT * FROM backtest_jobs
    WHERE handle = ?
      AND status IN ('queued', 'scanning', 'analyzing', 'complete')
      AND created_at > datetime('now', '-24 hours')
    ORDER BY created_at DESC
    LIMIT 1
  `),

  getCachedReport: db.prepare<[string], BacktestJob>(`
    SELECT * FROM backtest_jobs
    WHERE handle = ?
      AND status = 'complete'
      AND created_at > datetime('now', '-24 hours')
    ORDER BY created_at DESC
    LIMIT 1
  `),

  setScanning: db.prepare(
    "UPDATE backtest_jobs SET status = 'scanning', updated_at = datetime('now') WHERE id = ?",
  ),

  setAnalyzing: db.prepare(
    "UPDATE backtest_jobs SET status = 'analyzing', updated_at = datetime('now') WHERE id = ?",
  ),

  updateProgress: db.prepare(`
    UPDATE backtest_jobs
    SET phase = ?, tweets_scanned = ?, total_tweets = ?, calls_found = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `),

  completeJob: db.prepare(`
    UPDATE backtest_jobs
    SET status = 'complete', result_json = ?,
        completed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `),

  failJob: db.prepare(`
    UPDATE backtest_jobs
    SET status = 'failed', error = ?,
        completed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `),

  getRecentComplete: db.prepare<[], BacktestJob>(`
    SELECT * FROM backtest_jobs
    WHERE status = 'complete'
    ORDER BY completed_at DESC
    LIMIT 10
  `),
};

export function createBacktestJob(handle: string): string {
  const id = randomUUID();
  stmts.insertJob.run(id, handle);
  return id;
}

export function getBacktestJob(id: string): BacktestJob | undefined {
  return stmts.getJob.get(id) ?? undefined;
}

export function getCachedBacktestForHandle(handle: string): BacktestJob | undefined {
  return stmts.getCachedJob.get(handle) ?? undefined;
}

export function getCachedBacktestReport(handle: string): BacktestJob | undefined {
  return stmts.getCachedReport.get(handle) ?? undefined;
}

export function setBacktestScanning(id: string): void {
  stmts.setScanning.run(id);
}

export function setBacktestAnalyzing(id: string): void {
  stmts.setAnalyzing.run(id);
}

export function updateBacktestProgress(
  id: string,
  phase: string,
  tweetsScanned: number,
  totalTweets: number,
  callsFound: number,
): void {
  stmts.updateProgress.run(phase, tweetsScanned, totalTweets, callsFound, id);
}

export function completeBacktestJob(id: string, result: unknown): void {
  stmts.completeJob.run(JSON.stringify(result), id);
}

export function failBacktestJob(id: string, error: string): void {
  stmts.failJob.run(error, id);
}

export function getRecentBacktests(): BacktestJob[] {
  return stmts.getRecentComplete.all();
}
