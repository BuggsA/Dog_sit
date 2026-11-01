// Client "My account" page: bookings, pet profiles and contact details.
import { PETS, petSummary, money } from "./pricing.js";
import { icon } from "./site.js";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const today = new Date().toISOString().slice(0, 10);

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

async function api(path, opts = {}) {
  const r = await fetch(path, {
    method: opts.method || "GET",
    headers: { "content-type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: "manual",
  });
  // Login expired: reloading sends them back through the sign-in page
  if (r.type === "opaqueredirect" || r.status === 401) {
    location.reload();
    throw new Error("Please log in again");
  }
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || "Something went wrong");
  return out;
}

let data = null;

// ───────── Tabs ─────────
function showTab(tab) {
  document.querySelectorAll("#tabs button").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
    b.setAttribute("aria-selected", b.dataset.tab === tab);
  });
  document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.id !== `tab-${tab}`));
  history.replaceState(null, "", `#${tab}`);
}
$("#tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tab]");
  if (b) showTab(b.dataset.tab);
});

// ───────── Bookings ─────────
const STATUS = {
  pending: ["Waiting for Anissa", "clay"],
  approved: ["Confirmed", ""],
  declined: ["Not available", "grey"],
  done: ["Completed", "grey"],
};
function describe(b) {
  if (b.service === "overnight") return `Overnights · ${b.hours} hours a day at home with your pets`;
  if (b.service === "visit") return `${b.per_day} × ${b.minutes}-minute visit${b.per_day > 1 ? "s" : ""} a day`;
  return "Meet & greet";
}
function bookingCard(b) {
  const [label, cls] = STATUS[b.status] || [b.status, ""];
  const types = (b.pet_types || "").split(",").filter(Boolean);
  return `
    <article class="card booking ${esc(b.status)}">
      <div class="admin-bar">
        <h3 style="margin:0">${fmt(b.start_date)}${b.end_date !== b.start_date ? ` – ${fmt(b.end_date)}` : ""}</h3>
        <span class="pill ${cls}">${esc(label)}</span>
      </div>
      <p style="margin:8px 0 4px">${describe(b)}${types.length ? ` · ${esc(petSummary(types))}` : ""}</p>
      ${b.pets ? `<p class="muted small" style="margin:4px 0">${esc(b.pets)}</p>` : ""}
      ${b.notes ? `<p class="muted small" style="margin:4px 0">Your note: ${esc(b.notes)}</p>` : ""}
      <p class="muted small" style="margin:8px 0 0">Request #${b.id}${b.estimate != null ? ` · website estimate ${money(b.estimate)}` : ""}</p>
    </article>`;
}
function renderBookings() {
  const up = data.bookings.filter((b) => b.end_date >= today && (b.status === "pending" || b.status === "approved"));
  const past = data.bookings.filter((b) => !up.includes(b));
  up.sort((a, b) => a.start_date.localeCompare(b.start_date));
  $("#upcoming").innerHTML = up.length
    ? up.map(bookingCard).join("")
    : `<div class="card center"><p class="muted" style="margin-bottom:14px">Nothing booked right now.</p><a class="btn sm" href="/book">Request a visit</a></div>`;
  $("#past").innerHTML = past.length ? past.map(bookingCard).join("") : `<p class="muted">Nothing here yet.</p>`;
}

// ───────── Pets ─────────
const field = (pet, key, label, ph, rows) =>
  rows
    ? `<div class="field"><label for="p${pet.uid}-${key}">${label}</label><textarea id="p${pet.uid}-${key}" name="${key}" rows="${rows}" maxlength="1000" placeholder="${ph}">${esc(pet[key])}</textarea></div>`
    : `<div class="field"><label for="p${pet.uid}-${key}">${label}</label><input id="p${pet.uid}-${key}" name="${key}" maxlength="${key === "name" ? 60 : 100}" placeholder="${ph}" value="${esc(pet[key])}"></div>`;

let uid = 0;
function petEditor(pet = {}) {
  pet = { ...pet, uid: ++uid };
  const el = document.createElement("details");
  el.className = "pet-card pet-profile";
  if (pet.id) el.dataset.id = pet.id;
  el.innerHTML = `
    <summary class="pet-card-head">
      <span class="pet-badge">${icon(PETS[pet.type]?.icon || "paw")}</span>
      <span class="pet-title-wrap"><strong class="pet-title">${esc(pet.name || "New pet")}</strong>
        <span class="muted small pet-sub">${esc([PETS[pet.type]?.label, pet.breed, pet.age].filter(Boolean).join(" · "))}</span></span>
      <span class="pet-open">${icon("arrow")}</span>
    </summary>
    <form novalidate>
      <div class="field"><span class="label" id="pk${pet.uid}">What kind of pet?</span>
        <div class="choices" role="radiogroup" aria-labelledby="pk${pet.uid}">${Object.entries(PETS)
          .map(([k, p]) => `<input type="radio" name="type" id="p${pet.uid}-t-${k}" value="${k}"${k === pet.type ? " checked" : ""}><label for="p${pet.uid}-t-${k}">${icon(p.icon)}${p.label}</label>`)
          .join("")}</div></div>
      <div class="row">
        ${field(pet, "name", "Name", "e.g. Biscuit")}
        ${field(pet, "breed", "Breed", "e.g. Golden retriever")}
        ${field(pet, "age", "Age", "e.g. 5 years")}
      </div>
      ${field(pet, "feeding", "Feeding", "What, how much and when. e.g. 1 cup dry food at 7am and 5pm, no table scraps", 3)}
      ${field(pet, "medications", "Medications", "Name, dose and time, or leave blank", 2)}
      ${field(pet, "behavior", "Personality & habits", "Good with other dogs, cats or kids? Leash manners, fears, hiding spots, favorite toys…", 3)}
      ${field(pet, "notes", "Anything else", "Allergies, vet history, routines…", 2)}
      <div class="pet-actions">
        <button class="btn sm" type="submit">Save ${esc(pet.name || "pet")}</button>
        <button class="btn sm outline" type="button" data-remove>${pet.id ? "Remove" : "Cancel"}</button>
      </div>
    </form>`;

  const form = $("form", el);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    if (el.dataset.id) body.id = Number(el.dataset.id);
    if (!body.type) return toast("Please pick what kind of pet");
    if (!body.name?.trim()) return toast("Please add your pet's name");
    const btn = $("button[type=submit]", form);
    btn.disabled = true;
    try {
      const { id } = await api("/api/account/pets", { method: "POST", body });
      el.dataset.id = id;
      $(".pet-title", el).textContent = body.name.trim();
      $(".pet-sub", el).textContent = [PETS[body.type].label, body.breed, body.age].map((s) => s?.trim()).filter(Boolean).join(" · ");
      $(".pet-badge", el).innerHTML = icon(PETS[body.type].icon);
      btn.textContent = `Save ${body.name.trim()}`;
      $("[data-remove]", el).textContent = "Remove";
      el.open = false;
      toast(`${body.name.trim()} saved`);
      updatePetCount();
    } catch (err) {
      toast(err.message);
    } finally {
      btn.disabled = false;
    }
  });
  form.addEventListener("change", (e) => {
    if (e.target.name === "type") $(".pet-badge", el).innerHTML = icon(PETS[e.target.value].icon);
  });
  $("[data-remove]", el).addEventListener("click", async () => {
    const name = $(".pet-title", el).textContent;
    if (el.dataset.id) {
      if (!confirm(`Remove ${name} from your account?`)) return;
      try {
        await api("/api/account/pets", { method: "DELETE", body: { id: Number(el.dataset.id) } });
        toast(`${name} removed`);
      } catch (err) {
        return toast(err.message);
      }
    }
    el.remove();
    updatePetCount();
  });
  return el;
}
function updatePetCount() {
  const n = document.querySelectorAll(".pet-profile[data-id]").length;
  $("#pet-count").hidden = !n;
  $("#pet-count").textContent = n;
  updateNudge();
}
// One gentle prompt at a time: name & phone first, then pets
function updateNudge() {
  const nudge = $("#nudge");
  const c = data.client;
  const pets = document.querySelectorAll(".pet-profile[data-id]").length;
  if (!c.name || !c.phone) {
    nudge.hidden = false;
    nudge.innerHTML = `${icon("user")}<span><strong>Welcome! Start with your name and phone number</strong> so Anissa knows who you are. <a href="#details" data-go="details">Add my details</a></span>`;
  } else if (!pets) {
    nudge.hidden = false;
    nudge.innerHTML = `${icon("paw")}<span><strong>Tell Anissa about your pets.</strong> Add their feeding, medications and habits once, and she'll have it for every visit. <a href="#pets" data-go="pets">Add your pets</a></span>`;
  } else nudge.hidden = true;
}
$("#nudge").addEventListener("click", (e) => {
  if (e.target.dataset.go) {
    e.preventDefault();
    showTab(e.target.dataset.go);
    if (e.target.dataset.go === "details") $("#d-name").focus();
  }
});
$("#add-my-pet").addEventListener("click", () => {
  const el = petEditor();
  $("#my-pets").append(el);
  el.open = true;
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  $('input[type="radio"]', el).focus({ preventScroll: true });
});

// ───────── Details ─────────
const form = $("#details-form");
function fillDetails() {
  for (const el of form.elements) if (el.name) el.value = data.client[el.name] ?? "";
}
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#details-msg");
  const body = Object.fromEntries(new FormData(form));
  if (!body.name.trim()) {
    msg.textContent = "Please add your name.";
    $("#d-name").focus();
    return;
  }
  if (body.zip && !/^\d{5}$/.test(body.zip.trim())) {
    msg.textContent = "Please use a 5-digit ZIP code.";
    return;
  }
  const btn = $("button[type=submit]", form);
  btn.disabled = true;
  msg.textContent = "Saving…";
  try {
    await api("/api/account", { method: "PUT", body });
    Object.assign(data.client, body);
    msg.textContent = "";
    toast("Details saved");
    greet();
    updateNudge();
  } catch (err) {
    msg.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

function greet() {
  const first = (data.client.name || "").trim().split(/\s+/)[0];
  $("#hello").textContent = first ? `Hi ${first}` : "Welcome";
}

// ───────── Load ─────────
(async () => {
  try {
    data = await api("/api/account");
  } catch (err) {
    $("#loading").textContent = err.message;
    return;
  }
  $("#loading").remove();
  $("#who").textContent = data.email;
  greet();
  renderBookings();
  data.pets.forEach((p) => $("#my-pets").append(petEditor(p)));
  updatePetCount();
  fillDetails();
  const want = location.hash.slice(1);
  // Brand-new account: start on "My details" so they add their name first
  showTab(["bookings", "pets", "details"].includes(want) ? want : data.client.name ? "bookings" : "details");
})();
