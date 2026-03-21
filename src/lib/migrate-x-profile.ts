/**
 * Migration: Add X (Twitter) profile columns to the authors table.
 * Run once: npm run db:migrate-x-profile
 */

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log("Adding X profile columns to authors table...");

  await sql`ALTER TABLE authors ADD COLUMN IF NOT EXISTS avatar_url TEXT`;
  await sql`ALTER TABLE authors ADD COLUMN IF NOT EXISTS banner_url TEXT`;
  await sql`ALTER TABLE authors ADD COLUMN IF NOT EXISTS bio TEXT`;
  await sql`ALTER TABLE authors ADD COLUMN IF NOT EXISTS location TEXT`;
  await sql`ALTER TABLE authors ADD COLUMN IF NOT EXISTS website TEXT`;
  await sql`ALTER TABLE authors ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE authors ADD COLUMN IF NOT EXISTS followers INTEGER`;
  await sql`ALTER TABLE authors ADD COLUMN IF NOT EXISTS following INTEGER`;
  await sql`ALTER TABLE authors ADD COLUMN IF NOT EXISTS tweet_count INTEGER`;
  await sql`ALTER TABLE authors ADD COLUMN IF NOT EXISTS x_joined_at TIMESTAMPTZ`;
  await sql`ALTER TABLE authors ADD COLUMN IF NOT EXISTS x_profile_fetched_at TIMESTAMPTZ`;

  console.log("Migration complete. X profile columns added to authors table.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
