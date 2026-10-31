import { VISITS, OVERNIGHTS, PETS, estimate, money } from "./pricing.js";
import { classifyZip } from "./zones.js";
import { icon } from "./site.js";

const $ = (s) => document.querySelector(s);

$("#visit-prices").innerHTML = VISITS.map(
  (v) => `<tr><td><span class="name">${v.label}</span><small>${v.note}</small></td><td>${money(v.price)}</td></tr>`
).join("");
$("#overnight-prices").innerHTML = OVERNIGHTS.map(
  (o) => `<tr><td><span class="name">${o.label} with your pet</span><small>${o.note}</small></td><td>${money(o.price)}</td></tr>`
).join("");

const chips = (el, name, items, checkedVal) =>
  ($(el).innerHTML = items
    .map(
      ([val, label, ic]) =>
        `<input type="radio" name="${name}" id="${name}-${val}" value="${val}"${val == checkedVal ? " checked" : ""}><label for="${name}-${val}">${ic ? icon(ic) : ""}${label}</label>`
    )
    .join(""));

chips("#pet-choices", "pet", Object.entries(PETS).map(([k, p]) => [k, p.label, p.icon]), "dog");
chips("#svc-choices", "service", [["visit", "Walks & drop-ins", "leash"], ["overnight", "Overnights", "moon"]], "visit");
chips("#minute-choices", "minutes", VISITS.map((v) => [v.minutes, `${v.label} · ${money(v.price)}`]), 30);
chips("#hour-choices", "hours", OVERNIGHTS.map((o) => [o.hours, `${o.hours} hrs · ${money(o.price)}`]), 12);

const val = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value;

function update() {
  const service = val("service");
  const pet = val("pet");
  $("#visit-fields").hidden = service !== "visit";
  $("#overnight-fields").hidden = service !== "overnight";
  $("#age-wrap").hidden = pet !== "dog";

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

  $("#est-book").href = `/book?${new URLSearchParams({ service, pet, zip: $("#zip").value })}`;
}

$("#est-form").addEventListener("input", update);
$("#est-form").addEventListener("change", update);
update();
