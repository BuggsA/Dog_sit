// Builds the service-area map data (run occasionally, output is committed):
//   node scripts/build-zones.mjs
// 1. Drive-time areas from Reston (Valhalla routing on OpenStreetMap roads)
// 2. Clipped to Fairfax + Loudoun County (+ the cities inside them) so we don't spill into MD/DC/Arlington
// 3. Real ZIP code centers, classified into walk / overnight / outside
// Output: public/js/zone-data.js
import * as turf from "@turf/turf";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";

const HOME = { lat: 38.9586, lon: -77.357 }; // Reston
const WALK_MIN = 20;       // walks & drop-ins: ~20 min drive
const OVERNIGHT_MIN = 35;  // overnights: ~35 min drive (Aldie is ~31)
const WEST_LIMIT = -77.665; // nothing further west than Aldie
const UA = { "User-Agent": "walksforlucy-site-build/1.0 (+https://walksforlucy.com)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cache lookups so re-runs don't hammer the free servers
const CACHE = new URL("./.cache.json", import.meta.url);
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
async function nominatim(params) {
  const u = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams({ format: "geojson", ...params });
  if (cache[u]) return cache[u];
  for (let attempt = 1; attempt <= 5; attempt++) {
    await sleep(1500 * attempt); // be polite: well under 1 request/second
    const r = await fetch(u, { headers: UA });
    const text = await r.text();
    try {
      cache[u] = JSON.parse(text);
      writeFileSync(CACHE, JSON.stringify(cache));
      return cache[u];
    } catch {
      console.warn("retrying", params, r.status);
    }
  }
  throw new Error("Nominatim failed for " + JSON.stringify(params));
}

// --- counties
const areas = ["Fairfax County, Virginia", "Loudoun County, Virginia", "City of Fairfax, Virginia", "Falls Church, Virginia"];
let counties = null;
for (const q of areas) {
  const fc = await nominatim({ q, polygon_geojson: 1, limit: 1, polygon_threshold: 0.0005 });
  const f = fc.features.find((x) => x.geometry.type.includes("Polygon"));
  if (!f) throw new Error("No polygon for " + q);
  console.log("county", q, f.geometry.type);
  counties = counties ? turf.union(turf.featureCollection([counties, f])) : f;
}
counties = turf.intersect(turf.featureCollection([counties, turf.bboxPolygon([WEST_LIMIT, 38.5, -76.9, 39.4])]));

// --- isochrones
const iso = await (
  await fetch(
    "https://valhalla1.openstreetmap.de/isochrone?json=" +
      encodeURIComponent(
        JSON.stringify({
          locations: [HOME],
          costing: "auto",
          contours: [{ time: WALK_MIN }, { time: OVERNIGHT_MIN }],
          polygons: true,
          denoise: 0.6,
          generalize: 60,
        })
      ),
    { headers: UA }
  )
).json();
const byTime = Object.fromEntries(iso.features.map((f) => [f.properties.contour, f]));

const clip = (f) => {
  const out = turf.intersect(turf.featureCollection([f, counties]));
  // keep only the biggest piece (drop tiny islands) and simplify
  let poly = out;
  if (out.geometry.type === "MultiPolygon") {
    const parts = out.geometry.coordinates.map((c) => turf.polygon(c));
    poly = parts.sort((a, b) => turf.area(b) - turf.area(a))[0];
  }
  // drop holes so the shape reads as one clean area
  poly = turf.polygon([poly.geometry.coordinates[0]]);
  return turf.truncate(turf.simplify(poly, { tolerance: 0.0015, highQuality: true }), { precision: 4 });
};
const walk = clip(byTime[WALK_MIN]);
const overnight = clip(byTime[OVERNIGHT_MIN]);

// --- ZIP codes (Northern Virginia candidates; classification decides who's in)
const ZIPS = {
  // Fairfax County + cities
  20190: "Reston", 20191: "Reston", 20194: "Reston", 20170: "Herndon", 20171: "Herndon", 22066: "Great Falls",
  22124: "Oakton", 22180: "Vienna", 22181: "Vienna", 22182: "Vienna", 22102: "McLean", 22101: "McLean",
  22027: "Dunn Loring", 22033: "Fairfax", 22030: "Fairfax", 22031: "Fairfax", 22032: "Fairfax", 22035: "Fairfax",
  20151: "Chantilly", 20120: "Centreville", 20121: "Centreville", 20124: "Clifton", 22039: "Fairfax Station",
  22015: "Burke", 22043: "Falls Church", 22042: "Falls Church", 22041: "Falls Church", 22044: "Falls Church",
  22046: "Falls Church", 22003: "Annandale", 22150: "Springfield", 22151: "Springfield", 22152: "Springfield",
  22153: "Springfield", 22079: "Lorton", 22060: "Fort Belvoir", 22306: "Alexandria", 22307: "Alexandria",
  22308: "Alexandria", 22309: "Alexandria", 22310: "Alexandria", 22312: "Alexandria", 22315: "Alexandria",
  // Loudoun County
  20164: "Sterling", 20165: "Sterling", 20166: "Dulles", 20147: "Ashburn", 20148: "Ashburn", 20152: "Chantilly",
  20105: "Aldie", 20175: "Leesburg", 20176: "Leesburg", 20132: "Purcellville", 20158: "Hamilton",
  20180: "Lovettsville", 20141: "Round Hill", 20117: "Middleburg", 20197: "Waterford", 20129: "Paeonian Springs",
  // Nearby but outside the two counties (will classify as outside)
  22201: "Arlington", 22207: "Arlington", 22314: "Alexandria", 20155: "Gainesville", 20169: "Haymarket",
  20109: "Manassas", 20110: "Manassas", 20136: "Bristow", 20854: "Potomac", 20817: "Bethesda",
};

const counties2 = { fairfax: null, loudoun: null };
const zipOut = {};
for (const [zip, town] of Object.entries(ZIPS)) {
  const fc = await nominatim({ postalcode: zip, countrycodes: "us", limit: 1 });
  const f = fc.features[0];
  if (!f) { console.warn("no result", zip); continue; }
  const [lng, lat] = f.geometry.coordinates;
  const pt = turf.point([lng, lat]);
  const area = turf.booleanPointInPolygon(pt, walk) ? "walk" : turf.booleanPointInPolygon(pt, overnight) ? "overnight" : "outside";
  const loudoun = /^201(05|17|29|32|41|47|48|52|58|64|65|66|75|76|80|97)$/.test(zip);
  zipOut[zip] = { town, lat: +lat.toFixed(4), lng: +lng.toFixed(4), area, county: loudoun ? "loudoun" : "fairfax" };
  console.log(zip, town, area);
}

const js = `// GENERATED by scripts/build-zones.mjs: do not edit by hand.
// Drive-time areas from Reston (OpenStreetMap road data via Valhalla), clipped to Fairfax & Loudoun County.
export const WALK_MINUTES = ${WALK_MIN};
export const OVERNIGHT_MINUTES = ${OVERNIGHT_MIN};
export const WALK_AREA = ${JSON.stringify(walk.geometry.coordinates[0])};
export const OVERNIGHT_AREA = ${JSON.stringify(overnight.geometry.coordinates[0])};
export const ZIP_DATA = ${JSON.stringify(zipOut)};
`;
writeFileSync(new URL("../public/js/zone-data.js", import.meta.url), js);
console.log("wrote public/js/zone-data.js", js.length, "bytes");
