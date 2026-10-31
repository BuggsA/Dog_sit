// Keeps the "Towns I serve" list on area.html in sync with the map data.
// If this fails after running scripts/build-zones.mjs, update the towns list in public/area.html.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ZIP_DATA } from "../public/js/zone-data.js";

const html = readFileSync(new URL("../public/area.html", import.meta.url), "utf8");
const listed = { walk: new Set(), overnight: new Set() };
for (const m of html.matchAll(/class="town" data-walk="([^"]*)" data-overnight="([^"]*)"/g)) {
  m[1].split(" ").filter(Boolean).forEach((z) => listed.walk.add(z));
  m[2].split(" ").filter(Boolean).forEach((z) => listed.overnight.add(z));
}

test("every listed town ZIP matches the map data", () => {
  for (const area of ["walk", "overnight"]) {
    for (const z of listed[area]) assert.equal(ZIP_DATA[z]?.area, area, `ZIP ${z} is listed as ${area}`);
  }
});

test("every served ZIP appears in the towns list", () => {
  for (const [z, d] of Object.entries(ZIP_DATA)) {
    if (d.area === "outside") continue;
    assert.ok(listed[d.area].has(z), `ZIP ${z} (${d.town}) is missing from the towns list`);
  }
});
