import { PETS, MAX_PETS, petSummary, minVisitFor } from "./pricing.js";
import { classifyZip } from "./zones.js";
import { icon } from "./site.js";

const $ = (s) => document.querySelector(s);
const form = $("#book-form");
const params = new URLSearchParams(location.search);

$("#svc").innerHTML = [
  ["visit", "Walks & drop-ins", "leash"],
  ["overnight", "Overnights", "moon"],
  ["meet", "Just a meet & greet", "key"],
]
  .map(([v, l, i], n) => `<input type="radio" name="service" id="svc-${v}" value="${v}"${n === 0 ? " checked" : ""}><label for="svc-${v}">${icon(i)}${l}</label>`)
  .join("");

// ── Pets: one card per animal, add as many as needed ──
const petList = $("#pet-list");
const addBtn = $("#add-pet");
let petSeq = 0;
const cards = () => [...petList.querySelectorAll(".pet-card")];
const kindOf = (card) => card.querySelector('input[type="radio"]:checked')?.value || "";

function addPet(kind = "", focus = false) {
  const id = ++petSeq;
  const card = document.createElement("div");
  card.className = "pet-card";
  card.innerHTML = `
    <div class="pet-card-head">
      <span class="pet-badge">${icon("paw")}</span>
      <strong class="pet-title"></strong>
      <button type="button" class="pet-remove">${icon("close")}<span>Remove</span></button>
    </div>
    <div class="field pet-kind"><span class="label" id="pk-${id}">What kind of pet?</span>
      <div class="choices" role="radiogroup" aria-labelledby="pk-${id}">${Object.entries(PETS)
        .map(([k, p]) => `<input type="radio" name="kind-${id}" id="k-${id}-${k}" value="${k}"${k === kind ? " checked" : ""}><label for="k-${id}-${k}">${icon(p.icon)}${p.label}</label>`)
        .join("")}</div></div>
    <div class="row">
      <div class="field"><label for="pn-${id}">Name</label><input id="pn-${id}" data-f="name" maxlength="60" autocomplete="off" placeholder="e.g. Biscuit"></div>
      <div class="field"><label for="pd-${id}">Breed &amp; age</label><input id="pd-${id}" data-f="details" maxlength="120" autocomplete="off" placeholder="e.g. Golden retriever, 5 years"></div>
    </div>
    <label class="check pet-age" style="margin-bottom:12px" hidden><input type="checkbox" data-f="age"> Under 1 year or over 14 years old (custom pricing)</label>`;
  card.querySelector(".pet-remove").addEventListener("click", () => {
    const i = cards().indexOf(card);
    card.remove();
    refreshPets();
    const left = cards();
    (left[Math.min(i, left.length - 1)]?.querySelector(".pet-remove:not([hidden])") || addBtn).focus();
  });
  petList.append(card);
  refreshPets();
  if (focus) {
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    card.querySelector('input[type="radio"]').focus({ preventScroll: true });
  }
}

function refreshPets() {
  const all = cards();
  all.forEach((card, i) => {
    const kind = kindOf(card);
    const name = card.querySelector('[data-f="name"]').value.trim();
    card.querySelector(".pet-title").textContent = name || (kind ? `${PETS[kind].label} ${all.length > 1 ? i + 1 : ""}`.trim() : `Pet ${i + 1}`);
    card.querySelector(".pet-badge").innerHTML = icon(PETS[kind]?.icon || "paw");
    card.querySelector(".pet-remove").hidden = all.length === 1;
    card.querySelector(".pet-remove").setAttribute("aria-label", `Remove ${name || `pet ${i + 1}`}`);
    card.querySelector(".pet-age").hidden = kind !== "dog";
    if (kind) card.classList.remove("invalid");
  });
  addBtn.hidden = all.length >= MAX_PETS;
  const kinds = all.map(kindOf).filter(Boolean);
  $("#pet-summary").textContent = kinds.length ? `Caring for ${petSummary(kinds)}.` : "";
  syncMinutes();
}

// Grey out visit lengths that are too short for these pets (cats & small pets, or more than one pet)
function syncMinutes() {
  // Each card is one animal, even before its kind is picked
  const pets = cards().map((c) => kindOf(c) || "dog");
  const { minutes: min, reason } = minVisitFor(pets);
  const sel = document.getElementById("minutes");
  [...sel.options].forEach((o) => (o.disabled = Number(o.value) < min));
  if (Number(sel.value) < min) sel.value = String(min);
  const note = document.getElementById("min-note");
  note.hidden = !reason;
  note.textContent = reason;
}

addBtn.addEventListener("click", () => addPet("", true));
petList.addEventListener("input", refreshPets);
petList.addEventListener("change", refreshPets);

// Prefill from the estimator
const pre = (id) => { const el = document.getElementById(id); if (el) el.checked = true; };
const prefill = params.getAll("pet").filter((p) => PETS[p]).slice(0, MAX_PETS);
(prefill.length ? prefill : [""]).forEach((p) => addPet(p));

// Signed in to "My account"? Fill in their details and saved pets.
fetch("/api/account", { redirect: "manual" })
  .then((r) => (r.ok ? r.json() : null))
  .then((acct) => {
    if (!acct?.client) return;
    const c = acct.client;
    const fill = (id, v) => { const el = $(id); if (v && !el.value) el.value = v; };
    fill("#name", c.name);
    fill("#phone", c.phone);
    fill("#email", acct.email);
    fill("#zip", c.zip);
    // Swap the blank pet card for their saved pets (unless they came from the estimator with pets picked)
    if (acct.pets.length && !prefill.length && cards().length === 1 && !kindOf(cards()[0])) {
      cards()[0].remove();
      acct.pets.slice(0, MAX_PETS).forEach((p) => {
        addPet(p.type);
        const card = cards().at(-1);
        card.querySelector('[data-f="name"]').value = p.name;
        card.querySelector('[data-f="details"]').value = [p.breed, p.age].filter(Boolean).join(", ");
      });
      refreshPets();
    }
    sync();
    const note = $("#signed-in");
    note.hidden = false;
    note.innerHTML = `${icon("user")}<span>Signed in as <strong></strong>. We've filled in your details${acct.pets.length ? " and pets" : ""}. Remove any pets who don't need care this time.</span> <a href="/account/">My account</a>`;
    note.querySelector("strong").textContent = acct.email;
  })
  .catch(() => {});
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
  const petCards = cards();
  const pets = petCards.map((card) => ({
    type: kindOf(card),
    name: card.querySelector('[data-f="name"]').value.trim(),
    details: card.querySelector('[data-f="details"]').value.trim(),
    age: kindOf(card) === "dog" && card.querySelector('[data-f="age"]').checked,
  }));
  const data = {
    name: v("#name"), phone: v("#phone"), email: v("#email"), zip: v("#zip"),
    pets,
    service: service(), start: v("#start"), end: v("#end") || v("#start"),
    minutes: Number(v("#minutes")), perDay: Number(v("#perDay")), hours: Number(v("#hours")),
    notes: v("#notes"), newClient: $("#newClient").checked, consent: $("#consent").checked, website: v("#website"),
  };

  const missing = [];
  if (!data.name) missing.push("your name");
  if (!/\d{3}.*\d{3}.*\d{4}/.test(data.phone)) missing.push("a phone number");
  if (!/^\S+@\S+\.\S+$/.test(data.email)) missing.push("an email address");
  if (!/^\d{5}$/.test(data.zip)) missing.push("a 5-digit ZIP code");
  const unpicked = petCards.filter((card) => !kindOf(card));
  unpicked.forEach((card) => card.classList.add("invalid"));
  if (unpicked.length)
    missing.push(petCards.length === 1 ? "what kind of pet you have" : `the kind of pet for ${unpicked.map((c) => c.querySelector(".pet-title").textContent).join(", ")}`);
  if (!data.start) missing.push("a start date");
  if (data.end < data.start) missing.push("an end date after the start date");
  if (!data.consent) missing.push("permission to contact you");
  if (missing.length) {
    msg.textContent = `Please add ${missing.join(", ")}.`;
    msg.style.color = "var(--clay-dark)";
    unpicked[0]?.scrollIntoView({ behavior: "smooth", block: "center" });
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
