import { PETS } from "./pricing.js";
import { classifyZip } from "./zones.js";
import { icon } from "./site.js";

const $ = (s) => document.querySelector(s);
const form = $("#book-form");
const params = new URLSearchParams(location.search);

$("#pet-types").innerHTML = Object.entries(PETS)
  .map(([k, p]) => `<input type="checkbox" name="petTypes" id="pt-${k}" value="${k}"><label for="pt-${k}">${icon(p.icon)}${p.label}</label>`)
  .join("");
$("#svc").innerHTML = [
  ["visit", "Walks & drop-ins", "leash"],
  ["overnight", "Overnights", "moon"],
  ["meet", "Just a meet & greet", "key"],
]
  .map(([v, l, i], n) => `<input type="radio" name="service" id="svc-${v}" value="${v}"${n === 0 ? " checked" : ""}><label for="svc-${v}">${icon(i)}${l}</label>`)
  .join("");

// Prefill from the estimator
const pre = (id) => { const el = document.getElementById(id); if (el) el.checked = true; };
if (params.get("pet")) pre(`pt-${params.get("pet")}`);
if (params.get("service")) pre(`svc-${params.get("service")}`);
if (params.get("zip")) $("#zip").value = params.get("zip");

const today = new Date().toISOString().slice(0, 10);
$("#start").min = today;
$("#end").min = today;

const fmt = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
fetch("/api/availability")
  .then((r) => (r.ok ? r.json() : { blocked: [] }))
  .then(({ blocked = [] }) => {
    const upcoming = blocked.filter((x) => x >= today).slice(0, 12);
    if (!upcoming.length) return;
    const n = $("#blocked-note");
    n.hidden = false;
    n.innerHTML = `${icon("calendar")}<span><strong>Already booked:</strong> ${upcoming.map(fmt).join(", ")}. Requests on these days may be waitlisted.</span>`;
  })
  .catch(() => {});

const service = () => form.querySelector('input[name="service"]:checked').value;
function sync() {
  const svc = service();
  $("#visit-opts").hidden = svc !== "visit";
  $("#overnight-opts").hidden = svc !== "overnight";
  const z = classifyZip($("#zip").value);
  const info = $("#zip-info");
  if (!z) info.textContent = "";
  else if (z.area === "dc") info.textContent = "Washington, DC: overnights only (+50%).";
  else if (z.area === "outside") info.textContent = "This ZIP is outside the usual area, but send your request anyway and Anissa will let you know.";
  else info.textContent = `${z.town}, ${z.countyLabel}: ${z.visitsOk ? "walks, visits & overnights available" : "overnights available (walks are within ~20 min of Reston)"}`;
}
form.addEventListener("change", sync);
$("#zip").addEventListener("input", sync);
sync();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#form-msg");
  const v = (id) => $(id).value.trim();
  const petTypes = [...form.querySelectorAll('input[name="petTypes"]:checked')].map((i) => i.value);
  const data = {
    name: v("#name"), phone: v("#phone"), email: v("#email"), zip: v("#zip"),
    petTypes, pets: v("#pets"), ageFlag: $("#ageFlag").checked,
    service: service(), start: v("#start"), end: v("#end") || v("#start"),
    minutes: Number(v("#minutes")), perDay: Number(v("#perDay")), hours: Number(v("#hours")),
    notes: v("#notes"), newClient: $("#newClient").checked, consent: $("#consent").checked, website: v("#website"),
  };

  const missing = [];
  if (!data.name) missing.push("your name");
  if (!/\d{3}.*\d{3}.*\d{4}/.test(data.phone)) missing.push("a phone number");
  if (!/^\S+@\S+\.\S+$/.test(data.email)) missing.push("an email address");
  if (!/^\d{5}$/.test(data.zip)) missing.push("a 5-digit ZIP code");
  if (!petTypes.length) missing.push("your type of pet");
  if (!data.start) missing.push("a start date");
  if (data.end < data.start) missing.push("an end date after the start date");
  if (!data.consent) missing.push("permission to contact you");
  if (missing.length) {
    msg.textContent = `Please add ${missing.join(", ")}.`;
    msg.style.color = "var(--clay-dark)";
    return;
  }

  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  msg.style.color = "";
  msg.textContent = "Sending…";
  try {
    const r = await fetch("/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(out.error || "Something went wrong");
    form.hidden = true;
    $("#thanks").hidden = false;
    $("#thanks").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (err) {
    msg.innerHTML = `${err.message}. Please try again, or text Anissa at <a href="sms:+15418011068">(541) 801-1068</a>.`;
    msg.style.color = "var(--clay-dark)";
    btn.disabled = false;
  }
});
