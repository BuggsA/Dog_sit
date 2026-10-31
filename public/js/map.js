/* global L */
import { HOME, TOWNS, WALK_AREA, OVERNIGHT_AREA, classifyZip, classifyPoint } from "./zones.js";
import { icon } from "./site.js";

const toLatLng = (ring) => ring.map(([lng, lat]) => [lat, lng]);

const map = L.map("map", { scrollWheelZoom: false, zoomSnap: 0.25 });
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · drive times: Valhalla',
}).addTo(map);

const overnight = L.polygon(toLatLng(OVERNIGHT_AREA), {
  color: "#c2704f", weight: 2.5, dashArray: "7 6", fillColor: "#c2704f", fillOpacity: 0.1,
}).addTo(map);

L.polygon(toLatLng(WALK_AREA), {
  color: "#2f4a3f", weight: 3, fillColor: "#8aa894", fillOpacity: 0.35,
}).addTo(map);

map.fitBounds(overnight.getBounds(), { padding: [0, 0] });
map.setZoom(map.getZoom() + 0.25);

const pin = (id, cls = "") =>
  L.divIcon({ className: `map-pin ${cls}`, html: `<svg><use href="/img/icons.svg#${id}"/></svg>`, iconSize: [30, 30], iconAnchor: [15, 15] });

L.marker([HOME.lat, HOME.lng], { icon: pin("logo-bold", "home"), zIndexOffset: 1000 })
  .addTo(map)
  .bindTooltip("Reston (home base)", { permanent: true, direction: "bottom", offset: [0, 18], className: "town-label" });

TOWNS.forEach((t) => {
  L.circleMarker([t.lat, t.lng], { radius: 4, color: "#2f4a3f", weight: 2, fillColor: "#fff", fillOpacity: 1 })
    .addTo(map)
    .bindTooltip(t.name, { permanent: true, direction: "right", offset: [6, 0], className: "town-label" });
});

// ZIP checker
let marker;
document.getElementById("zip-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const out = document.getElementById("zip-result");
  const z = classifyZip(document.getElementById("zip").value);
  const show = (ic, html) => { out.innerHTML = `${icon(ic)}<span>${html}</span>`; out.classList.add("show"); };
  if (marker) marker.remove();
  if (!z) return show("sparkle", "Please enter a 5-digit ZIP code.");
  if (z.area === "dc") return show("pin", "<strong>Washington, DC:</strong> overnights only, with a 50% upcharge.");
  if (z.area === "outside") {
    return show("pin", `<strong>${z.zip}</strong> is outside the usual service area, but <a href="sms:+15418011068">text Anissa</a> and she'll let you know if she can help.`);
  }
  marker = L.marker([z.lat, z.lng], { icon: pin("pin") }).addTo(map);
  map.setView([z.lat, z.lng], 11);
  show(
    "check",
    z.visitsOk
      ? `<strong>Great news: ${z.town} (${z.zip})</strong> is in range for walks, drop-in visits <em>and</em> overnights.`
      : `<strong>${z.town} (${z.zip})</strong> is in range for <strong>overnights</strong>. For walks and drop-ins, <a href="sms:+15418011068">text Anissa</a> to check.`
  );
});

// Click anywhere on the map to check that spot
map.on("click", (e) => {
  const a = classifyPoint(e.latlng.lat, e.latlng.lng);
  const msg = a === "walk" ? "Walks, drop-ins & overnights" : a === "overnight" ? "Overnights" : "Outside the usual area";
  L.popup().setLatLng(e.latlng).setContent(`<strong>${msg}</strong>`).openOn(map);
});
