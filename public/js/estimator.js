import { VISITS, OVERNIGHTS, PETS, MAX_PETS, estimate, minVisitFor, petSummary, money } from "./pricing.js";
import { classifyZip } from "./zones.js";
import { icon } from "./site.js";

const $ = (s) => document.querySelector(s);

$("#visit-prices").innerHTML = VISITS.map(
  (v) => `<tr><td><span class="name">${v.label}</span><small>${v.note}</small></td><td>${money(v.price)}</td></tr>`
).join("");
$("#overnight-prices").innerHTML = OVERNIGHTS.map(
  (o) => `<tr><td><span class="name">${o.hours < 24 ? "At least " : ""}${o.label} with your pet</span><small>${o.note}</small></td><td>${money(o.price)}</td></tr>`
).join("");

const chips = (el, name, items, checkedVal) =>
  ($(el).innerHTML = items
    .map(
      ([val, label, ic]) =>
        `<input type="radio" name="${name}" id="${name}-${val}" value="${val}"${val == checkedVal ? " checked" : ""}><label for="${name}-${val}">${ic ? icon(ic) : ""}${label}</label>`
    )
    .join(""));

// How many of each kind of pet (starts with one dog)
const counts = Object.fromEntries(Object.keys(PETS).map((k) => [k, k === "dog" ? 1 : 0]));
const petsList = () => Object.keys(PETS).flatMap((k) => Array(counts[k]).fill(k));
$("#pet-choices").innerHTML = Object.entries(PETS)
  .map(
    ([k, p]) => `
    <div class="pet-count" data-kind="${k}">
      <span class="pet-count-name">${icon(p.icon)}${p.label}</span>
      <div class="stepper sm">
        <button type="button" data-step="-1" aria-label="One less ${p.noun}">${icon("minus")}</button>
        <output aria-live="polite" aria-label="${p.plural}">0</output>
        <button type="button" data-step="1" aria-label="One more ${p.noun}">${icon("plus")}</button>
      </div>
    </div>`
  )
  .join("");
$("#pet-choices").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-step]");
  if (!b) return;
  const k = b.closest(".pet-count").dataset.kind;
  const step = Number(b.dataset.step);
  if (step > 0 && petsList().length >= MAX_PETS) return;
  counts[k] = Math.max(0, counts[k] + step);
  update();
});
chips("#svc-choices", "service", [["visit", "Walks & drop-ins", "leash"], ["overnight", "Overnights", "moon"]], "visit");
chips("#minute-choices", "minutes", VISITS.map((v) => [v.minutes, `${v.label} · ${money(v.price)}`]), 30);
chips("#hour-choices", "hours", OVERNIGHTS.map((o) => [o.hours, `${o.hours} hrs · ${money(o.price)}`]), 12);

const val = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;

function update() {
  const service = val("service");
  const pets = petsList();
  const total = pets.length;
  document.querySelectorAll(".pet-count").forEach((row) => {
    const n = counts[row.dataset.kind];
    row.classList.toggle("on", n > 0);
    row.querySelector("output").textContent = n;
    row.querySelector('[data-step="-1"]').disabled = n === 0 || (n === 1 && total === 1);
    row.querySelector('[data-step="1"]').disabled = total >= MAX_PETS;
  });
  $("#pet-total").textContent = total > 1 ? `Caring for ${petSummary(pets)}. Same price, however many pets.` : "";
  $("#visit-fields").hidden = service !== "visit";
  $("#overnight-fields").hidden = service !== "overnight";
  $("#age-wrap").hidden = !counts.dog;

  const feeding = $("#feeding").checked;
  const { minutes: min, reason } = minVisitFor(pets, feeding);
  const note = $("#min-note");
  note.hidden = min <= 15;
  note.textContent = reason + (feeding && total === 1 && PETS[pets[0]].minVisit <= 15 ? " Untick feeding for a quick 15-minute walk." : "");
  document.querySelectorAll('input[name="minutes"]').forEach((i) => {
    i.disabled = Number(i.value) < min;
    if (i.disabled && i.checked) document.getElementById("minutes-30").checked = true;
  });

  const zone = classifyZip($("#zip").value);
  const r = estimate({
    service,
    pets,
    minutes: val("minutes"),
    hours: val("hours"),
    perDay: $("#perDay").value,
    days: service === "visit" ? $("#days-v").value : $("#days-o").value,
    feeding: $("#feeding").checked,
    zone,
    ageFlag: counts.dog > 0 && $("#ageFlag").checked,
  });

  if (r.contact) {
    $("#est-total").textContent = "Custom quote";
    $("#est-lines").innerHTML = `<p>${r.contact}</p><a class="btn light sm" href="sms:+15418011068">${icon("message")} Text Anissa</a>`;
  } else {
    $("#est-total").textContent = r.total === 0 ? "$0" : money(r.total);
    $("#est-lines").innerHTML = r.lines
      .map((l) => `<div class="line"><span>${l.label}</span><strong>${money(l.amount)}</strong></div>`)
      .join("");
  }
  let z = "";
  if (!zone) z = "Add your ZIP code to check your area and include the meet & greet.";
  else if (zone.area === "inside") z = `${zone.town}, ${zone.countyLabel} · ${zone.visitsOk ? "walks, visits & overnights" : "overnights"}`;
  else if (zone.area === "dc") z = "Washington, DC · overnights only";
  $("#est-zone").innerHTML = z ? `<div class="zone">${icon("pin")}<span>${z}</span></div>` : "";
  $("#est-warn").innerHTML = r.warnings.map((w) => `<div class="warn">${icon("sparkle")}<span>${w}</span></div>`).join("");

  const q = new URLSearchParams({ service, zip: $("#zip").value });
  pets.forEach((p) => q.append("pet", p));
  $("#est-book").href = `/book?${q}`;
}

$("#est-form").addEventListener("input", update);
$("#est-form").addEventListener("change", update);
update();
