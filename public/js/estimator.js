import { VISITS, OVERNIGHTS, PETS, INCLUDED, estimate, money } from "./pricing.js";
import { classifyZip } from "./zones.js";

const $ = (s) => document.querySelector(s);

// Price tables
$("#visit-prices").innerHTML = VISITS.map(
  (v) => `<tr><td>${v.label}<small>${v.note}</small></td><td>${money(v.price)}</td></tr>`
).join("");
$("#overnight-prices").innerHTML = OVERNIGHTS.map(
  (o) => `<tr><td>${o.label}</td><td>${money(o.price)}</td></tr>`
).join("");
$("#included").innerHTML = INCLUDED.map((i) => `<li>${i}</li>`).join("");

// Choice chips
const chips = (el, name, items, checkedVal) =>
  ($(el).innerHTML = items
    .map(
      ([val, label]) =>
        `<input type="radio" name="${name}" id="${name}-${val}" value="${val}"${val == checkedVal ? " checked" : ""}><label for="${name}-${val}">${label}</label>`
    )
    .join(""));

chips("#pet-choices", "pet", Object.entries(PETS).map(([k, p]) => [k, `${p.emoji} ${p.label}`]), "dog");
chips("#minute-choices", "minutes", VISITS.map((v) => [v.minutes, `${v.label} · ${money(v.price)}`]), 30);
chips("#hour-choices", "hours", OVERNIGHTS.map((o) => [o.hours, `${o.hours} hrs · ${money(o.price)}`]), 12);

const val = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;

function update() {
  const service = val("service");
  const pet = val("pet");
  $("#visit-fields").hidden = service !== "visit";
  $("#overnight-fields").hidden = service !== "overnight";
  $("#age-wrap").hidden = pet !== "dog";

  // Disable visit lengths that are too short for this pet / feeding
  const min = Math.max(PETS[pet].minVisit, $("#feeding").checked ? 30 : 0);
  document.querySelectorAll('input[name="minutes"]').forEach((i) => {
    i.disabled = Number(i.value) < min;
    if (i.disabled && i.checked) document.getElementById("minutes-30").checked = true;
  });

  const zone = classifyZip($("#zip").value);
  const r = estimate({
    service,
    pet,
    minutes: val("minutes"),
    hours: val("hours"),
    perDay: $("#perDay").value,
    days: service === "visit" ? $("#days-v").value : $("#days-o").value,
    feeding: $("#feeding").checked,
    zone,
    ageFlag: pet === "dog" && $("#ageFlag").checked,
  });

  if (r.contact) {
    $("#est-total").textContent = "Let's chat!";
    $("#est-lines").innerHTML = `<p>${r.contact}</p><p><a class="btn teal small" href="sms:+15418011068">💬 Text Anissa</a></p>`;
  } else {
    $("#est-total").textContent = money(r.total).replace("FREE", "$0");
    $("#est-lines").innerHTML = r.lines
      .map((l) => `<div class="line"><span>${l.label}</span><strong>${money(l.amount)}</strong></div>`)
      .join("");
  }
  $("#est-zone").textContent = zone
    ? zone.area === "inside"
      ? `📍 ${zone.town}, ${zone.countyLabel} · about ${zone.miles.toFixed(1)} mi from Reston`
      : zone.area === "dc"
      ? "📍 Washington, DC"
      : ""
    : "Add your ZIP to include the meet & greet + check your area.";
  $("#est-warn").innerHTML = r.warnings.map((w) => `<div class="warn">⚠️ ${w}</div>`).join("");

  // Carry choices to booking form
  const q = new URLSearchParams({ service, pet, zip: $("#zip").value });
  $("#est-book").href = `/book?${q}`;
}

document.getElementById("est-form").addEventListener("input", update);
document.getElementById("est-form").addEventListener("change", update);
update();
