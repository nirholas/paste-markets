/**
 * Import scraped X profile locations into DB and geocode them.
 * Usage: npx tsx src/lib/import-locations.ts
 */

import { neon } from "@neondatabase/serverless";
import { geocode } from "./geocode";

const sql = neon(process.env.DATABASE_URL!);

const scraped: Record<string, string> = {
  fejau_inc: "Canada",
  karpathy: "Stanford",
  chang_defi: "Korea",
  MartyMakary: "Washington D.C.",
  DeepDishEnjoyer: "boston, ma",
  yonki_mercados: "granada",
  Citrini7: "New York, NY",
  KobeissiLetter: "United States",
  PhotonCap: "US",
  CitriniResearch: "United States",
  JohnnyPayps: "New York, USA",
  menon_aahan: "New York, NY",
  coinbureau: "Dubai",
  RaoulGMI: "Cayman Islands",
  washingtonpost: "Washington, DC",
  deanwball: "Washington, DC",
  frankdegods: "nyc",
  AndrewYang: "United States",
  BobEUnlimited: "New York, NY",
  travisk: "Austin, TX",
  federalreserve: "Washington, D.C",
  TKL_Adam: "United States",
  TheStalwart: "New York City",
  alanrog3: "Dubai",
  wallstengine: "Wall Street",
  Ike_Saul: "Philadelphia, PA",
  packym: "New York",
  palantirtech: "Miami, FL",
  KrisAbdelmessih: "SF Bay Area, CA",
  jukan05: "San Jose",
  howardmarks: "Los Angeles",
  jason: "austin",
  DeItaone: "Geneva, Switzerland",
  UnHerd: "London, United Kingdom",
  markets: "New York",
  hvgoenka: "Mumbai",
  TheDiaryOfACEO: "Lagos, Nigeria",
  DoubleEph: "This Sceptred Isle",
  PeterLBrandt: "Lawless MN and AZ desert",
  TMTLongShort: "🇺🇸 Kardashev Type: 0.1",
  saranormous: "on ⛓",
  blknoiz06: "onchain 🌒",
  CryptoCapo_: "The charts",
  goodalexander: "The Blockchain",
  CryptoMikli: "Blockchain",
  friedberg: "earth",
  spectatorindex: "Global",
  "0xMoco": "etherscan/solscan",
};

async function main() {
  console.log("=== Importing scraped X locations ===\n");

  let updated = 0;
  let geocoded = 0;
  let unresolvable = 0;
  const failed: Array<{ handle: string; location: string }> = [];

  for (const [handle, location] of Object.entries(scraped)) {
    // Update location in DB
    await sql`
      UPDATE authors SET location = ${location}
      WHERE handle = ${handle} AND (location IS NULL OR location = '')
    `;

    // Try to geocode
    const coord = geocode(location);
    if (coord) {
      await sql`
        UPDATE authors SET lat = ${coord.lat}, lng = ${coord.lng}
        WHERE handle = ${handle}
      `;
      geocoded++;
      console.log(`  ✓ @${handle}: "${location}" → ${coord.label} (${coord.lat}, ${coord.lng})`);
    } else {
      failed.push({ handle, location });
      unresolvable++;
      console.log(`  ✗ @${handle}: "${location}" → unresolvable`);
    }
    updated++;
  }

  console.log(`\n=== Results ===`);
  console.log(`  Total processed: ${updated}`);
  console.log(`  Geocoded:        ${geocoded}`);
  console.log(`  Unresolvable:    ${unresolvable}`);

  if (failed.length > 0) {
    console.log(`\n=== Unresolvable (need to add to geocode.ts) ===`);
    for (const f of failed) {
      console.log(`  @${f.handle}: "${f.location}"`);
    }
  }
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
