/* global L */
import { BUSINESS } from "./pricing.js";
import { TOWNS, OVERNIGHT_ZONE, DC_CENTER, ZIPS, classifyZip } from "./zones.js";

const map = L.map("map", { scrollWheelZoom: false }).setView([38.93, -77.38], 10);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

L.polygon(OVERNIGHT_ZONE, { color: "#f4b400", weight: 3, dashArray: "8 6", fillColor: "#ffd166", fillOpacity: 0.25 })
  .addTo(map)
  .bindPopup("<b>🌙 Overnight zone</b><br>Fairfax County + eastern Loudoun, out to Aldie");

L.circle([BUSINESS.home.lat, BUSINESS.home.lng], {
  radius: BUSINESS.visitRadiusMiles * 1609.34,
  color: "#179c90",
  weight: 3,
  fillColor: "#2ec4b6",
  fillOpacity: 0.3,
})
  .addTo(map)
  .bindPopup("<b>🦮 Walks & drop-ins</b><br>About 6 miles around Reston");

const pawIcon = (emoji) => L.divIcon({ className: "paw-pin", html: emoji, iconSize: [30, 30], iconAnchor: [15, 15] });

TOWNS.forEach((t) => {
  const m = L.marker([t.lat, t.lng], { icon: pawIcon(t.home ? "🏠" : t.edge ? "🚩" : "🐾") }).addTo(map);
  m.bindTooltip(t.home ? "Reston (home base)" : t.edge ? `${t.name} (furthest out)` : t.name, {
    permanent: true,
    direction: "right",
    offset: [10, 0],
    className: "town-label",
  });
});

L.marker([DC_CENTER.lat, DC_CENTER.lng], { icon: pawIcon("🏛️") })
  .addTo(map)
  .bindTooltip("Washington, DC · overnights +50%", { permanent: true, direction: "right", offset: [10, 0], className: "town-label" });

// ZIP checker
let zipMarker;
document.getElementById("zip-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const zip = document.getElementById("zip").value.trim();
  const out = document.getElementById("zip-result");
  const z = classifyZip(zip);
  if (!z) return (out.textContent = "Hmm, that doesn't look like a 5-digit ZIP code. 🐶❓");
  if (zipMarker) zipMarker.remove();
  if (z.area === "dc") {
    out.innerHTML = "🏛️ Washington, DC: <strong>overnights only</strong>, with a 50% upcharge.";
    map.setView([DC_CENTER.lat, DC_CENTER.lng], 11);
    return;
  }
  if (z.area === "outside") {
    out.innerHTML = `😿 ${zip} is outside my usual area. <a href="sms:+15418011068">Text me</a> and we'll see what we can do!`;
    return;
  }
  const p = ZIPS[zip];
  zipMarker = L.marker([p.lat, p.lng], { icon: pawIcon("📍") }).addTo(map);
  map.setView([p.lat, p.lng], 11);
  out.innerHTML = z.visitsOk
    ? `🎉 ${z.town} (${z.countyLabel}), about ${z.miles.toFixed(1)} miles out. <strong>Walks, drop-ins &amp; overnights</strong> all available!`
    : `🌙 ${z.town} (${z.countyLabel}), about ${z.miles.toFixed(1)} miles out. <strong>Overnights</strong> available! For walks &amp; drop-ins, <a href="sms:+15418011068">text me</a> to check.`;
});
