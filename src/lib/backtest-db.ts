/**
 * DB operations for backtest jobs.
 * Mirrors scan-db.ts pattern but with extended fields for backtest reporting.
 */

import { randomUUID } from "node:crypto";
import { sql } from "./db";

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

export async function createBacktestJob(handle: string): Promise<string> {
  const id = randomUUID();
  await sql`INSERT INTO backtest_jobs (id, handle) VALUES (${id}, ${handle})`;
  return id;
}

export async function getBacktestJob(id: string): Promise<BacktestJob | undefined> {
  const rows = await sql`SELECT * FROM backtest_jobs WHERE id = ${id}`;
  return (rows[0] as BacktestJob) ?? undefined;
}

export async function getCachedBacktestForHandle(handle: string): Promise<BacktestJob | undefined> {
  const rows = await sql`
    SELECT * FROM backtest_jobs
    WHERE handle = ${handle}
      AND status IN ('queued', 'scanning', 'analyzing', 'complete')
      AND created_at > (NOW() - INTERVAL '24 hours')::text
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return (rows[0] as BacktestJob) ?? undefined;
}

export async function getCachedBacktestReport(handle: string): Promise<BacktestJob | undefined> {
  const rows = await sql`
    SELECT * FROM backtest_jobs
    WHERE handle = ${handle}
      AND status = 'complete'
      AND created_at > (NOW() - INTERVAL '24 hours')::text
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return (rows[0] as BacktestJob) ?? undefined;
}

export async function setBacktestScanning(id: string): Promise<void> {
  await sql`UPDATE backtest_jobs SET status = 'scanning', updated_at = NOW()::text WHERE id = ${id}`;
}

export async function setBacktestAnalyzing(id: string): Promise<void> {
  await sql`UPDATE backtest_jobs SET status = 'analyzing', updated_at = NOW()::text WHERE id = ${id}`;
}

export async function updateBacktestProgress(
  id: string,
  phase: string,
  tweetsScanned: number,
  totalTweets: number,
  callsFound: number,
): Promise<void> {
  await sql`
    UPDATE backtest_jobs
    SET phase = ${phase}, tweets_scanned = ${tweetsScanned}, total_tweets = ${totalTweets},
        calls_found = ${callsFound}, updated_at = NOW()::text
    WHERE id = ${id}
  `;
}

export async function completeBacktestJob(id: string, result: unknown): Promise<void> {
  await sql`
    UPDATE backtest_jobs
    SET status = 'complete', result_json = ${JSON.stringify(result)},
        completed_at = NOW()::text, updated_at = NOW()::text
    WHERE id = ${id}
  `;
}

export async function failBacktestJob(id: string, error: string): Promise<void> {
  await sql`
    UPDATE backtest_jobs
    SET status = 'failed', error = ${error},
        completed_at = NOW()::text, updated_at = NOW()::text
    WHERE id = ${id}
  `;
}

export async function getRecentBacktests(): Promise<BacktestJob[]> {
  const rows = await sql`
    SELECT * FROM backtest_jobs
    WHERE status = 'complete'
    ORDER BY completed_at DESC
    LIMIT 10
  `;
  return rows as BacktestJob[];
}
