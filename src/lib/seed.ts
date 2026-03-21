/**
 * Seed script — populates the database with initial tracked authors.
 * Run with: npm run db:seed
 */

import { getOrCreateAuthor } from "./db";

const INITIAL_AUTHORS = [
  "frankdegods",
  "nichxbt",
  "AzFlin",
  "0xRiver8",
  "CryptoKaleo",
  "GCRClassic",
  "hsaborern",
  "blknoiz06",
  "ColdBloodShill",
  "Pentosh1",
];

console.log("Seeding database with initial authors...");

for (const handle of INITIAL_AUTHORS) {
  const author = getOrCreateAuthor(handle);
  console.log(`  + @${author.handle}`);
}

console.log(`Done. ${INITIAL_AUTHORS.length} authors seeded.`);
