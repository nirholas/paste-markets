/**
 * Geocoding: convert Twitter/X location strings to lat/lng coordinates.
 *
 * Uses a hardcoded dictionary of ~200 common locations that CT users set
 * on their X profiles. Covers major cities, US states, countries, and
 * common shorthand ("NYC", "SF", "LDN", "Down Bad", etc.).
 *
 * Falls back to null if location can't be resolved.
 */

export interface GeoCoord {
  lat: number;
  lng: number;
  label: string; // resolved city/region name
}

// ── City / region dictionary ────────────────────────────────────────────────

const LOCATIONS: Record<string, GeoCoord> = {};

function add(keys: string[], coord: GeoCoord) {
  for (const key of keys) {
    LOCATIONS[key.toLowerCase().trim()] = coord;
  }
}

// North America — US cities
add(["new york", "new york city", "nyc", "new york, ny", "manhattan", "brooklyn", "queens", "bronx", "new york, usa", "ny", "new york, new york"], { lat: 40.71, lng: -74.01, label: "New York" });
add(["los angeles", "la", "los angeles, ca", "los angeles, california", "hollywood", "west hollywood", "santa monica", "venice beach", "los angeles, usa"], { lat: 34.05, lng: -118.24, label: "Los Angeles" });
add(["san francisco", "sf", "san francisco, ca", "san francisco, california", "the bay", "bay area", "san francisco bay area"], { lat: 37.77, lng: -122.42, label: "San Francisco" });
add(["miami", "miami, fl", "miami, florida", "south beach", "miami beach", "305", "mia"], { lat: 25.76, lng: -80.19, label: "Miami" });
add(["chicago", "chicago, il", "chicago, illinois", "chi-town", "chi"], { lat: 41.88, lng: -87.63, label: "Chicago" });
add(["austin", "austin, tx", "austin, texas", "atx"], { lat: 30.27, lng: -97.74, label: "Austin" });
add(["houston", "houston, tx", "houston, texas"], { lat: 29.76, lng: -95.37, label: "Houston" });
add(["dallas", "dallas, tx", "dallas, texas", "dfw"], { lat: 32.78, lng: -96.80, label: "Dallas" });
add(["denver", "denver, co", "denver, colorado", "mile high city"], { lat: 39.74, lng: -104.99, label: "Denver" });
add(["seattle", "seattle, wa", "seattle, washington"], { lat: 47.61, lng: -122.33, label: "Seattle" });
add(["portland", "portland, or", "portland, oregon", "pdx"], { lat: 45.52, lng: -122.68, label: "Portland" });
add(["boston", "boston, ma", "boston, massachusetts"], { lat: 42.36, lng: -71.06, label: "Boston" });
add(["san diego", "san diego, ca", "san diego, california"], { lat: 32.72, lng: -117.16, label: "San Diego" });
add(["atlanta", "atlanta, ga", "atlanta, georgia", "atl"], { lat: 33.75, lng: -84.39, label: "Atlanta" });
add(["nashville", "nashville, tn", "nashville, tennessee"], { lat: 36.16, lng: -86.78, label: "Nashville" });
add(["las vegas", "vegas", "las vegas, nv", "las vegas, nevada", "sin city", "lv"], { lat: 36.17, lng: -115.14, label: "Las Vegas" });
add(["washington", "washington dc", "washington, dc", "dc", "d.c.", "washington d.c."], { lat: 38.91, lng: -77.04, label: "Washington DC" });
add(["philadelphia", "philly", "philadelphia, pa"], { lat: 39.95, lng: -75.17, label: "Philadelphia" });
add(["phoenix", "phoenix, az", "phoenix, arizona"], { lat: 33.45, lng: -112.07, label: "Phoenix" });
add(["san jose", "san jose, ca", "silicon valley"], { lat: 37.34, lng: -121.89, label: "San Jose" });
add(["detroit", "detroit, mi", "detroit, michigan"], { lat: 42.33, lng: -83.05, label: "Detroit" });
add(["minneapolis", "minneapolis, mn"], { lat: 44.98, lng: -93.27, label: "Minneapolis" });
add(["salt lake city", "slc", "salt lake city, ut"], { lat: 40.76, lng: -111.89, label: "Salt Lake City" });
add(["charlotte", "charlotte, nc"], { lat: 35.23, lng: -80.84, label: "Charlotte" });
add(["tampa", "tampa, fl", "tampa bay"], { lat: 27.95, lng: -82.46, label: "Tampa" });
add(["raleigh", "raleigh, nc"], { lat: 35.78, lng: -78.64, label: "Raleigh" });
add(["pittsburgh", "pittsburgh, pa"], { lat: 40.44, lng: -79.99, label: "Pittsburgh" });
add(["honolulu", "honolulu, hi", "hawaii", "oahu"], { lat: 21.31, lng: -157.86, label: "Honolulu" });

// US states (center points)
add(["texas", "tx"], { lat: 31.97, lng: -99.90, label: "Texas" });
add(["california", "ca", "cali"], { lat: 36.78, lng: -119.42, label: "California" });
add(["florida", "fl"], { lat: 27.66, lng: -81.52, label: "Florida" });
add(["colorado", "co"], { lat: 39.55, lng: -105.78, label: "Colorado" });
add(["georgia", "ga"], { lat: 32.17, lng: -82.91, label: "Georgia" });
add(["illinois", "il"], { lat: 40.63, lng: -89.40, label: "Illinois" });
add(["ohio", "oh"], { lat: 40.42, lng: -82.91, label: "Ohio" });
add(["new jersey", "nj"], { lat: 40.06, lng: -74.41, label: "New Jersey" });
add(["connecticut", "ct"], { lat: 41.60, lng: -72.76, label: "Connecticut" });
add(["virginia", "va"], { lat: 37.43, lng: -78.66, label: "Virginia" });
add(["north carolina", "nc"], { lat: 35.76, lng: -79.02, label: "North Carolina" });
add(["massachusetts", "ma"], { lat: 42.41, lng: -71.38, label: "Massachusetts" });

// North America — Canada
add(["toronto", "toronto, on", "toronto, canada", "the 6ix", "the six", "6ix", "yyz"], { lat: 43.65, lng: -79.38, label: "Toronto" });
add(["vancouver", "vancouver, bc", "vancouver, canada", "yvr"], { lat: 49.28, lng: -123.12, label: "Vancouver" });
add(["montreal", "montréal", "montreal, qc", "montreal, canada"], { lat: 45.50, lng: -73.57, label: "Montreal" });
add(["calgary", "calgary, ab", "calgary, canada"], { lat: 51.05, lng: -114.07, label: "Calgary" });
add(["ottawa", "ottawa, on", "ottawa, canada"], { lat: 45.42, lng: -75.70, label: "Ottawa" });
add(["canada"], { lat: 56.13, lng: -106.35, label: "Canada" });

// North America — Mexico
add(["mexico city", "cdmx", "ciudad de méxico"], { lat: 19.43, lng: -99.13, label: "Mexico City" });
add(["mexico", "méxico"], { lat: 23.63, lng: -102.55, label: "Mexico" });

// Europe
add(["london", "london, uk", "london, england", "ldn", "london, united kingdom", "city of london"], { lat: 51.51, lng: -0.13, label: "London" });
add(["paris", "paris, france"], { lat: 48.86, lng: 2.35, label: "Paris" });
add(["berlin", "berlin, germany", "berlin, de"], { lat: 52.52, lng: 13.41, label: "Berlin" });
add(["amsterdam", "amsterdam, netherlands", "amsterdam, nl", "ams"], { lat: 52.37, lng: 4.90, label: "Amsterdam" });
add(["zurich", "zürich", "zurich, switzerland", "zurich, ch"], { lat: 47.38, lng: 8.54, label: "Zurich" });
add(["lisbon", "lisboa", "lisbon, portugal"], { lat: 38.72, lng: -9.14, label: "Lisbon" });
add(["dublin", "dublin, ireland"], { lat: 53.35, lng: -6.26, label: "Dublin" });
add(["barcelona", "barcelona, spain", "bcn"], { lat: 41.39, lng: 2.17, label: "Barcelona" });
add(["madrid", "madrid, spain"], { lat: 40.42, lng: -3.70, label: "Madrid" });
add(["rome", "roma", "rome, italy"], { lat: 41.90, lng: 12.50, label: "Rome" });
add(["milan", "milano", "milan, italy"], { lat: 45.46, lng: 9.19, label: "Milan" });
add(["vienna", "wien", "vienna, austria"], { lat: 48.21, lng: 16.37, label: "Vienna" });
add(["stockholm", "stockholm, sweden"], { lat: 59.33, lng: 18.07, label: "Stockholm" });
add(["copenhagen", "copenhagen, denmark", "cph"], { lat: 55.68, lng: 12.57, label: "Copenhagen" });
add(["oslo", "oslo, norway"], { lat: 59.91, lng: 10.75, label: "Oslo" });
add(["helsinki", "helsinki, finland"], { lat: 60.17, lng: 24.94, label: "Helsinki" });
add(["prague", "praha", "prague, czech republic", "prague, czechia"], { lat: 50.08, lng: 14.44, label: "Prague" });
add(["warsaw", "warszawa", "warsaw, poland"], { lat: 52.23, lng: 21.01, label: "Warsaw" });
add(["munich", "münchen", "munich, germany"], { lat: 48.14, lng: 11.58, label: "Munich" });
add(["frankfurt", "frankfurt, germany", "frankfurt am main"], { lat: 50.11, lng: 8.68, label: "Frankfurt" });
add(["edinburgh", "edinburgh, uk", "edinburgh, scotland"], { lat: 55.95, lng: -3.19, label: "Edinburgh" });
add(["manchester", "manchester, uk"], { lat: 53.48, lng: -2.24, label: "Manchester" });
add(["uk", "united kingdom", "england", "britain", "great britain"], { lat: 51.51, lng: -0.13, label: "UK" });
add(["germany", "deutschland", "de"], { lat: 51.17, lng: 10.45, label: "Germany" });
add(["france", "fr"], { lat: 46.60, lng: 1.89, label: "France" });
add(["spain", "españa", "es"], { lat: 40.46, lng: -3.75, label: "Spain" });
add(["italy", "italia", "it"], { lat: 41.87, lng: 12.57, label: "Italy" });
add(["netherlands", "holland", "nl", "the netherlands"], { lat: 52.13, lng: 5.29, label: "Netherlands" });
add(["switzerland", "suisse", "schweiz", "ch"], { lat: 46.82, lng: 8.23, label: "Switzerland" });
add(["portugal", "pt"], { lat: 39.40, lng: -8.22, label: "Portugal" });
add(["sweden", "se"], { lat: 60.13, lng: 18.64, label: "Sweden" });
add(["ireland", "ie"], { lat: 53.14, lng: -7.69, label: "Ireland" });
add(["poland", "pl"], { lat: 51.92, lng: 19.15, label: "Poland" });

// Middle East
add(["dubai", "dubai, uae", "dubai, united arab emirates", "dxb"], { lat: 25.20, lng: 55.27, label: "Dubai" });
add(["abu dhabi", "abu dhabi, uae"], { lat: 24.45, lng: 54.65, label: "Abu Dhabi" });
add(["uae", "united arab emirates", "emirates"], { lat: 25.20, lng: 55.27, label: "UAE" });
add(["riyadh", "riyadh, saudi arabia"], { lat: 24.71, lng: 46.67, label: "Riyadh" });
add(["saudi arabia", "ksa", "saudi"], { lat: 23.89, lng: 45.08, label: "Saudi Arabia" });
add(["tel aviv", "tel aviv, israel", "tlv"], { lat: 32.09, lng: 34.78, label: "Tel Aviv" });
add(["israel", "il"], { lat: 31.05, lng: 34.85, label: "Israel" });
add(["doha", "doha, qatar", "qatar"], { lat: 25.29, lng: 51.53, label: "Doha" });
add(["bahrain", "manama"], { lat: 26.07, lng: 50.56, label: "Bahrain" });
add(["istanbul", "istanbul, turkey", "istanbul, türkiye"], { lat: 41.01, lng: 28.98, label: "Istanbul" });
add(["turkey", "türkiye", "tr"], { lat: 38.96, lng: 35.24, label: "Turkey" });

// Asia
add(["singapore", "sg", "singapore, singapore"], { lat: 1.35, lng: 103.82, label: "Singapore" });
add(["tokyo", "tokyo, japan", "tyo"], { lat: 35.68, lng: 139.65, label: "Tokyo" });
add(["hong kong", "hk", "hong kong, china"], { lat: 22.32, lng: 114.17, label: "Hong Kong" });
add(["seoul", "seoul, south korea", "서울", "south korea", "korea"], { lat: 37.57, lng: 126.98, label: "Seoul" });
add(["shanghai", "shanghai, china"], { lat: 31.23, lng: 121.47, label: "Shanghai" });
add(["beijing", "beijing, china", "peking"], { lat: 39.90, lng: 116.41, label: "Beijing" });
add(["taipei", "taipei, taiwan", "taiwan"], { lat: 25.03, lng: 121.57, label: "Taipei" });
add(["bangkok", "bangkok, thailand", "bkk", "thailand"], { lat: 13.76, lng: 100.50, label: "Bangkok" });
add(["mumbai", "mumbai, india", "bombay"], { lat: 19.08, lng: 72.88, label: "Mumbai" });
add(["bangalore", "bengaluru", "bangalore, india", "bengaluru, india"], { lat: 12.97, lng: 77.59, label: "Bangalore" });
add(["new delhi", "delhi", "new delhi, india", "delhi, india"], { lat: 28.61, lng: 77.21, label: "Delhi" });
add(["india", "in"], { lat: 20.59, lng: 78.96, label: "India" });
add(["japan", "jp"], { lat: 36.20, lng: 138.25, label: "Japan" });
add(["china", "cn"], { lat: 35.86, lng: 104.20, label: "China" });
add(["philippines", "ph", "manila", "manila, philippines"], { lat: 14.60, lng: 120.98, label: "Manila" });
add(["vietnam", "vn", "hanoi", "ho chi minh city", "saigon"], { lat: 14.06, lng: 108.28, label: "Vietnam" });
add(["indonesia", "id", "jakarta"], { lat: -6.21, lng: 106.85, label: "Jakarta" });
add(["malaysia", "my", "kuala lumpur", "kl"], { lat: 3.14, lng: 101.69, label: "Kuala Lumpur" });

// Oceania
add(["sydney", "sydney, australia", "syd"], { lat: -33.87, lng: 151.21, label: "Sydney" });
add(["melbourne", "melbourne, australia", "mel"], { lat: -37.81, lng: 144.96, label: "Melbourne" });
add(["brisbane", "brisbane, australia"], { lat: -27.47, lng: 153.03, label: "Brisbane" });
add(["perth", "perth, australia"], { lat: -31.95, lng: 115.86, label: "Perth" });
add(["australia", "au", "aus", "down under"], { lat: -25.27, lng: 133.78, label: "Australia" });
add(["new zealand", "nz", "auckland", "auckland, new zealand"], { lat: -36.85, lng: 174.76, label: "Auckland" });

// South America
add(["são paulo", "sao paulo", "são paulo, brazil", "sp"], { lat: -23.55, lng: -46.63, label: "São Paulo" });
add(["rio de janeiro", "rio", "rio, brazil"], { lat: -22.91, lng: -43.17, label: "Rio de Janeiro" });
add(["brazil", "brasil", "br"], { lat: -14.24, lng: -51.93, label: "Brazil" });
add(["buenos aires", "buenos aires, argentina", "bsas"], { lat: -34.60, lng: -58.38, label: "Buenos Aires" });
add(["argentina", "ar"], { lat: -38.42, lng: -63.62, label: "Argentina" });
add(["bogotá", "bogota", "bogotá, colombia", "colombia"], { lat: 4.71, lng: -74.07, label: "Bogotá" });
add(["santiago", "santiago, chile", "chile"], { lat: -33.45, lng: -70.67, label: "Santiago" });
add(["lima", "lima, peru", "peru"], { lat: -12.05, lng: -77.04, label: "Lima" });
add(["medellín", "medellin", "medellín, colombia"], { lat: 6.25, lng: -75.56, label: "Medellín" });

// Africa
add(["lagos", "lagos, nigeria"], { lat: 6.52, lng: 3.38, label: "Lagos" });
add(["nairobi", "nairobi, kenya", "kenya"], { lat: -1.29, lng: 36.82, label: "Nairobi" });
add(["cape town", "cape town, south africa"], { lat: -33.92, lng: 18.42, label: "Cape Town" });
add(["johannesburg", "johannesburg, south africa", "joburg"], { lat: -26.20, lng: 28.05, label: "Johannesburg" });
add(["south africa", "za"], { lat: -30.56, lng: 22.94, label: "South Africa" });
add(["nigeria", "ng"], { lat: 9.08, lng: 8.68, label: "Nigeria" });
add(["cairo", "cairo, egypt", "egypt"], { lat: 30.04, lng: 31.24, label: "Cairo" });
add(["accra", "accra, ghana", "ghana"], { lat: 5.60, lng: -0.19, label: "Accra" });

// Crypto-specific / meme locations (common on CT)
add(["the internet", "internet", "online", "worldwide", "global", "everywhere", "earth", "planet earth", "world"], { lat: 20.0, lng: 0.0, label: "Global" });
add(["the cloud", "cloud", "metaverse", "web3", "on-chain", "onchain", "on chain", "decentralized"], { lat: 37.77, lng: -122.42, label: "San Francisco" }); // default to SF for crypto-native
add(["gm", "gm ☀️", "wagmi"], { lat: 40.71, lng: -74.01, label: "New York" }); // default to NYC

// Common CT shorthand
add(["el salvador"], { lat: 13.79, lng: -88.90, label: "El Salvador" });
add(["puerto rico", "pr"], { lat: 18.22, lng: -66.59, label: "Puerto Rico" });
add(["cayman islands", "caymans"], { lat: 19.31, lng: -81.25, label: "Cayman Islands" });
add(["bermuda"], { lat: 32.32, lng: -64.76, label: "Bermuda" });
add(["monaco"], { lat: 43.74, lng: 7.43, label: "Monaco" });
add(["malta"], { lat: 35.94, lng: 14.38, label: "Malta" });
add(["cyprus"], { lat: 35.13, lng: 33.43, label: "Cyprus" });
add(["bali", "bali, indonesia"], { lat: -8.34, lng: 115.09, label: "Bali" });
add(["chiang mai", "chiang mai, thailand"], { lat: 18.79, lng: 98.98, label: "Chiang Mai" });

// USA catch-all
add(["usa", "us", "united states", "united states of america", "america", "🇺🇸"], { lat: 39.83, lng: -98.58, label: "USA" });

// ── Geocoding function ──────────────────────────────────────────────────────

/**
 * Attempt to geocode a free-text location string (typically from an X profile).
 * Returns null if the location can't be resolved.
 */
export function geocode(location: string | null | undefined): GeoCoord | null {
  if (!location) return null;

  const cleaned = location.trim();
  if (!cleaned || cleaned.length < 2) return null;

  // Direct lookup
  const direct = LOCATIONS[cleaned.toLowerCase()];
  if (direct) return direct;

  // Try without trailing emojis/symbols
  const noEmoji = cleaned.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, "").trim();
  if (noEmoji !== cleaned) {
    const emojiLookup = LOCATIONS[noEmoji.toLowerCase()];
    if (emojiLookup) return emojiLookup;
  }

  // Try first part before comma (e.g., "Miami, FL" → "Miami")
  const parts = cleaned.split(",");
  if (parts.length > 1) {
    const firstPart = parts[0]!.trim();
    const lookup = LOCATIONS[firstPart.toLowerCase()];
    if (lookup) return lookup;
  }

  // Try each word/phrase against known locations
  const words = cleaned.toLowerCase().split(/[\s,\/\-|]+/);
  for (const word of words) {
    if (word.length >= 2) {
      const lookup = LOCATIONS[word];
      if (lookup) return lookup;
    }
  }

  // Try two-word combos
  for (let i = 0; i < words.length - 1; i++) {
    const twoWord = `${words[i]} ${words[i + 1]}`;
    const lookup = LOCATIONS[twoWord];
    if (lookup) return lookup;
  }

  return null;
}

/**
 * Batch geocode: given a map of handle → location string,
 * returns a map of handle → GeoCoord (only entries that resolved).
 */
export function geocodeBatch(
  locations: Record<string, string | null>,
): Record<string, GeoCoord> {
  const results: Record<string, GeoCoord> = {};
  for (const [handle, loc] of Object.entries(locations)) {
    const coord = geocode(loc);
    if (coord) {
      results[handle] = coord;
    }
  }
  return results;
}
