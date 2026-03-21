/**
 * Migration: Add X (Twitter) profile columns to the authors table.
 * Run once: npm run db:migrate-x-profile
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Adding X profile columns to authors table...");

  // Add columns one at a time (IF NOT EXISTS not supported for ADD COLUMN in all PG versions,
  // so we catch duplicates)
  const columns = [
    "ALTER TABLE authors ADD COLUMN IF NOT EXISTS avatar_url TEXT",
    "ALTER TABLE authors ADD COLUMN IF NOT EXISTS banner_url TEXT",
    "ALTER TABLE authors ADD COLUMN IF NOT EXISTS bio TEXT",
    "ALTER TABLE authors ADD COLUMN IF NOT EXISTS location TEXT",
    "ALTER TABLE authors ADD COLUMN IF NOT EXISTS website TEXT",
    "ALTER TABLE authors ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE",
    "ALTER TABLE authors ADD COLUMN IF NOT EXISTS followers INTEGER",
    "ALTER TABLE authors ADD COLUMN IF NOT EXISTS following INTEGER",
    "ALTER TABLE authors ADD COLUMN IF NOT EXISTS tweet_count INTEGER",
    "ALTER TABLE authors ADD COLUMN IF NOT EXISTS x_joined_at TIMESTAMPTZ",
    "ALTER TABLE authors ADD COLUMN IF NOT EXISTS x_profile_fetched_at TIMESTAMPTZ",
  ];

  for (const ddl of columns) {
    try {
      await sql(ddl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already exists")) {
        // Column already added — skip
      } else {
        console.error(`Failed: ${ddl}`, err);
        throw err;
      }
    }
  }

  console.log("Migration complete. X profile columns added to authors table.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
