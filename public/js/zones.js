// ─────────────────────────────────────────────────────────────
//  Service area: ZIP codes, towns, and the map outline.
//  Coordinates are approximate ZIP centers. Anissa always
//  confirms the final address at the meet & greet.
// ─────────────────────────────────────────────────────────────
import { BUSINESS } from "./pricing.js";

// [zip, town, county, lat, lng]
const Z = [
  // Fairfax County
  ["20190", "Reston", "fairfax", 38.959, -77.342],
  ["20191", "Reston", "fairfax", 38.934, -77.351],
  ["20194", "Reston", "fairfax", 38.979, -77.343],
  ["20170", "Herndon", "fairfax", 38.981, -77.384],
  ["20171", "Herndon / Oak Hill", "fairfax", 38.925, -77.398],
  ["22066", "Great Falls", "fairfax", 39.005, -77.300],
  ["22124", "Oakton", "fairfax", 38.890, -77.320],
  ["22180", "Vienna", "fairfax", 38.900, -77.255],
  ["22181", "Vienna", "fairfax", 38.900, -77.295],
  ["22182", "Vienna / Tysons", "fairfax", 38.935, -77.270],
  ["22102", "McLean / Tysons", "fairfax", 38.950, -77.225],
  ["22101", "McLean", "fairfax", 38.935, -77.180],
  ["22027", "Dunn Loring", "fairfax", 38.894, -77.220],
  ["22033", "Fairfax / Fair Oaks", "fairfax", 38.877, -77.385],
  ["22030", "Fairfax", "fairfax", 38.845, -77.330],
  ["22031", "Fairfax", "fairfax", 38.860, -77.260],
  ["22032", "Fairfax", "fairfax", 38.820, -77.290],
  ["20151", "Chantilly", "fairfax", 38.890, -77.445],
  ["20120", "Centreville", "fairfax", 38.855, -77.465],
  ["20121", "Centreville", "fairfax", 38.818, -77.450],
  ["20124", "Clifton", "fairfax", 38.780, -77.390],
  ["22039", "Fairfax Station", "fairfax", 38.760, -77.310],
  ["22015", "Burke", "fairfax", 38.790, -77.270],
  ["22043", "Falls Church", "fairfax", 38.900, -77.190],
  ["22042", "Falls Church", "fairfax", 38.865, -77.195],
  ["22041", "Falls Church", "fairfax", 38.850, -77.145],
  ["22044", "Falls Church", "fairfax", 38.860, -77.155],
  ["22003", "Annandale", "fairfax", 38.830, -77.215],
  ["22150", "Springfield", "fairfax", 38.775, -77.185],
  ["22151", "Springfield", "fairfax", 38.805, -77.210],
  ["22152", "Springfield", "fairfax", 38.775, -77.230],
  ["22153", "Springfield", "fairfax", 38.745, -77.235],
  ["22079", "Lorton", "fairfax", 38.695, -77.215],
  ["22306", "Alexandria (Fairfax Co.)", "fairfax", 38.755, -77.090],
  ["22307", "Alexandria (Fairfax Co.)", "fairfax", 38.770, -77.060],
  ["22308", "Alexandria (Fairfax Co.)", "fairfax", 38.730, -77.060],
  ["22309", "Alexandria (Fairfax Co.)", "fairfax", 38.720, -77.105],
  ["22310", "Alexandria (Fairfax Co.)", "fairfax", 38.785, -77.125],
  ["22312", "Alexandria (Fairfax Co.)", "fairfax", 38.815, -77.155],
  ["22315", "Alexandria (Fairfax Co.)", "fairfax", 38.755, -77.150],
  // Loudoun County (eastern side, out to Aldie)
  ["20164", "Sterling", "loudoun", 39.012, -77.394],
  ["20165", "Sterling / Potomac Falls", "loudoun", 39.050, -77.390],
  ["20166", "Dulles / Sterling", "loudoun", 38.985, -77.455],
  ["20147", "Ashburn", "loudoun", 39.043, -77.483],
  ["20148", "Ashburn / Brambleton", "loudoun", 38.992, -77.530],
  ["20152", "South Riding / Chantilly", "loudoun", 38.900, -77.510],
  ["20105", "Aldie", "loudoun", 38.960, -77.610],
];

export const ZIPS = Object.fromEntries(
  Z.map(([zip, town, county, lat, lng]) => [zip, { zip, town, county, lat, lng }])
);

export const COUNTY_LABEL = { fairfax: "Fairfax County", loudoun: "Loudoun County", dc: "Washington, DC" };

export function milesBetween(a, b) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Returns { area, county, countyLabel, town, miles, visitsOk } or null if zip invalid. */
export function classifyZip(zipRaw) {
  const zip = String(zipRaw || "").trim().slice(0, 5);
  if (!/^\d{5}$/.test(zip)) return null;
  if (/^200\d\d$/.test(zip) || /^20[2-5]\d\d$/.test(zip)) { // DC: 200xx, 202xx–205xx (201xx is Virginia!)
    return { area: "dc", county: "dc", countyLabel: COUNTY_LABEL.dc, town: "Washington, DC", miles: 20, visitsOk: false };
  }
  const z = ZIPS[zip];
  if (!z) return { area: "outside", county: null, countyLabel: "Outside service area", town: null, miles: null, visitsOk: false };
  const miles = milesBetween(BUSINESS.home, z);
  return {
    area: "inside",
    county: z.county,
    countyLabel: COUNTY_LABEL[z.county],
    town: z.town,
    miles,
    visitsOk: miles <= BUSINESS.visitRadiusMiles + 0.5, // small grace for approximate ZIP centers
  };
}

// Towns shown as paw pins on the map
export const TOWNS = [
  { name: "Reston", lat: 38.9586, lng: -77.357, home: true },
  { name: "Herndon", lat: 38.9696, lng: -77.3861 },
  { name: "Great Falls", lat: 39.0023, lng: -77.2886 },
  { name: "Vienna", lat: 38.9012, lng: -77.2653 },
  { name: "McLean", lat: 38.9339, lng: -77.1773 },
  { name: "Oakton", lat: 38.881, lng: -77.301 },
  { name: "Fairfax", lat: 38.8462, lng: -77.3064 },
  { name: "Chantilly", lat: 38.8943, lng: -77.4311 },
  { name: "Centreville", lat: 38.8404, lng: -77.4289 },
  { name: "Sterling", lat: 39.0062, lng: -77.4286 },
  { name: "Ashburn", lat: 39.0438, lng: -77.4874 },
  { name: "South Riding", lat: 38.9209, lng: -77.5039 },
  { name: "Brambleton", lat: 38.9818, lng: -77.5386 },
  { name: "Aldie", lat: 38.9757, lng: -77.6416, edge: true },
  { name: "Springfield", lat: 38.7893, lng: -77.1872 },
  { name: "Burke", lat: 38.7934, lng: -77.2717 },
];

// Rough outline of the overnight zone: Fairfax County + eastern Loudoun out to Aldie.
export const OVERNIGHT_ZONE = [
  [39.055, -77.255], // Potomac above Great Falls
  [38.985, -77.185],
  [38.935, -77.12],  // Chain Bridge / McLean
  [38.895, -77.165],
  [38.845, -77.11],
  [38.80, -77.085],
  [38.79, -77.04],   // Potomac by Alexandria
  [38.71, -77.045],  // Mount Vernon
  [38.67, -77.13],
  [38.645, -77.22],  // Occoquan
  [38.70, -77.31],
  [38.77, -77.42],   // Bull Run
  [38.83, -77.53],
  [38.88, -77.56],   // South Riding / Loudoun line
  [38.94, -77.66],
  [38.99, -77.67],   // just past Aldie
  [39.04, -77.585],
  [39.075, -77.52],  // north Ashburn
  [39.09, -77.46],   // Lansdowne
  [39.065, -77.39],  // Potomac Falls
];

export const DC_CENTER = { lat: 38.9072, lng: -77.0369 };
