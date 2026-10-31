// ─────────────────────────────────────────────────────────────
//  Service area logic.
//  The shapes come from real drive times on the road network
//  (see scripts/build-zones.mjs → zone-data.js).
// ─────────────────────────────────────────────────────────────
import { WALK_AREA, OVERNIGHT_AREA, ZIP_DATA, WALK_MINUTES, OVERNIGHT_MINUTES } from "./zone-data.js";

export { WALK_AREA, OVERNIGHT_AREA, WALK_MINUTES, OVERNIGHT_MINUTES };
export const HOME = { name: "Reston", lat: 38.9586, lng: -77.357 };
export const COUNTY_LABEL = { fairfax: "Fairfax County", loudoun: "Loudoun County", dc: "Washington, DC" };

/** Ray-casting point-in-polygon. ring = [[lng, lat], ...] */
export function inside(lng, lat, ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Classify any point. */
export function classifyPoint(lat, lng) {
  if (inside(lng, lat, WALK_AREA)) return "walk";
  if (inside(lng, lat, OVERNIGHT_AREA)) return "overnight";
  return "outside";
}

/**
 * Returns { zip, area: "inside"|"dc"|"outside", county, countyLabel, town, visitsOk, lat, lng }
 * or null for an invalid ZIP.
 */
export function classifyZip(zipRaw) {
  const zip = String(zipRaw || "").trim().slice(0, 5);
  if (!/^\d{5}$/.test(zip)) return null;
  // DC: 200xx and 202xx–205xx (careful: 201xx is Northern Virginia!)
  if (/^200\d\d$/.test(zip) || /^20[2-5]\d\d$/.test(zip)) {
    return { zip, area: "dc", county: "dc", countyLabel: COUNTY_LABEL.dc, town: "Washington, DC", visitsOk: false, lat: 38.9072, lng: -77.0369 };
  }
  const z = ZIP_DATA[zip];
  if (!z || z.area === "outside") {
    return { zip, area: "outside", county: null, countyLabel: "Outside service area", town: z?.town || null, visitsOk: false, lat: z?.lat, lng: z?.lng };
  }
  return {
    zip,
    area: "inside",
    county: z.county,
    countyLabel: COUNTY_LABEL[z.county],
    town: z.town,
    visitsOk: z.area === "walk",
    lat: z.lat,
    lng: z.lng,
  };
}

// Town labels for the map
export const TOWNS = [
  { name: "Vienna", lat: 38.9012, lng: -77.2653 },
  { name: "McLean", lat: 38.9339, lng: -77.1773 },
  { name: "Fairfax", lat: 38.8462, lng: -77.3064 },
  { name: "Chantilly", lat: 38.8943, lng: -77.4311 },
  { name: "Centreville", lat: 38.8404, lng: -77.4289 },
  { name: "Sterling", lat: 39.0062, lng: -77.4286 },
  { name: "Ashburn", lat: 39.0438, lng: -77.4874 },
  { name: "Leesburg", lat: 39.1157, lng: -77.5636 },
  { name: "South Riding", lat: 38.9209, lng: -77.5039 },
  { name: "Aldie", lat: 38.9758, lng: -77.6416 },
  { name: "Springfield", lat: 38.7893, lng: -77.1872 },
];
