import { PETS } from "./pricing.js";
import { classifyZip } from "./zones.js";

const $ = (s) => document.querySelector(s);
const form = $("#book-form");
const params = new URLSearchParams(location.search);

// Pet type chips (multi-select)
$("#pet-types").innerHTML = Object.entries(PETS)
  .map(
    ([k, p]) =>
      `<input type="checkbox" name="petTypes" id="pt-${k}" value="${k}"><label for="pt-${k}">${p.emoji} ${p.label}</label>`
  )
  .join("");

// Prefill from estimator
if (params.get("pet")) { const el = document.getElementById(`pt-${params.get("pet")}`); if (el) el.checked = true; }
if (params.get("service")) { const el = document.getElementById(`svc-${params.get("service")}`); if (el) el.checked = true; }
if (params.get("zip")) $("#zip").value = params.get("zip");

const today = new Date().toISOString().slice(0, 10);
$("#start").min = today;
$("#end").min = today;

let blocked = [];
function fmt(d) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
fetch("/api/availability")
  .then((r) => (r.ok ? r.json() : { blocked: [] }))
  .then((d) => {
    blocked = d.blocked || [];
    const upcoming = blocked.filter((x) => x >= today).slice(0, 12);
    if (upcoming.length) {
      $("#blocked-note").hidden = false;
      $("#blocked-note").innerHTML = `🗓️ <strong>Anissa is already booked on:</strong> ${upcoming.map(fmt).join(", ")}. Requests on those days may need to be waitlisted.`;
    }
  })
  .catch(() => {});

function sync() {
  const svc = form.service.value;
  $("#visit-opts").hidden = svc !== "visit";
  $("#overnight-opts").hidden = svc !== "overnight";
  const z = classifyZip($("#zip").value);
  const info = $("#zip-info");
  if (!z) info.textContent = "";
  else if (z.area === "dc") info.innerHTML = "🏛️ Washington, DC: overnights only (+50%).";
  else if (z.area === "outside") info.innerHTML = "😿 That ZIP is outside the usual area, but send it anyway and Anissa will let you know!";
  else info.innerHTML = `📍 ${z.town}, ${z.countyLabel}${z.visitsOk ? "" : " · overnights only (walks are within ~6 mi of Reston)"}`;
}
form.addEventListener("change", sync);
$("#zip").addEventListener("input", sync);
sync();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#form-msg");
  const petTypes = [...form.querySelectorAll('input[name="petTypes"]:checked')].map((i) => i.value);
  const data = {
    name: $("#name").value.trim(),
    phone: form.phone.value.trim(),
    email: form.email.value.trim(),
    zip: form.zip.value.trim(),
    petTypes,
    pets: form.pets.value.trim(),
    ageFlag: form.ageFlag.checked,
    service: form.service.value,
    start: form.start.value,
    end: form.end.value || form.start.value,
    minutes: Number(form.minutes.value),
    perDay: Number(form.perDay.value),
    hours: Number(form.hours.value),
    notes: form.notes.value.trim(),
    newClient: form.newClient.checked,
    consent: form.consent.checked,
    website: form.website.value,
  };

  const problems = [];
  if (!data.name) problems.push("your name");
  if (!/\d{3}.*\d{3}.*\d{4}/.test(data.phone)) problems.push("a phone number");
  if (!/^\S+@\S+\.\S+$/.test(data.email)) problems.push("an email");
  if (!/^\d{5}$/.test(data.zip)) problems.push("a 5-digit ZIP");
  if (!petTypes.length) problems.push("what kind of pet");
  if (!data.start) problems.push("a start date");
  if (data.end < data.start) problems.push("an end date after the start date");
  if (!data.consent) problems.push("the OK to contact you");
  if (problems.length) {
    msg.textContent = `🐶 Almost! Please add ${problems.join(", ")}.`;
    return;
  }

  const btn = form.querySelector("button[type=submit]");
  btn.disabled = true;
  msg.textContent = "Sending… 🐕💨";
  try {
    const r = await fetch("/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(out.error || "Something went wrong");
    form.hidden = true;
    $("#thanks").hidden = false;
    $("#thanks").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (err) {
    msg.innerHTML = `😿 ${err.message}. Please try again, or text Anissa at <a href="sms:+15418011068">541-801-1068</a>.`;
    btn.disabled = false;
  }
});
