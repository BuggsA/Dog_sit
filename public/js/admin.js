import { PETS, money, petSummary } from "./pricing.js";
import { CHECKLIST, MAX_PHOTOS, reportHTML, enableLightbox, shrinkPhoto } from "./visits.js";
const icon = (id) => `<svg class="i" aria-hidden="true"><use href="/img/icons.svg#${id}"/></svg>`;

const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

async function api(path, opts = {}) {
  const r = await fetch(path, {
    ...opts,
    headers: { "content-type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (r.status === 401) throw new Error("Please log in again (Cloudflare Access).");
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Request failed");
  return r.json();
}

// ───────── Requests ─────────
let current = "pending";

function describe(r) {
  if (r.service === "overnight") return `Overnights · ${r.hours} hrs/day`;
  if (r.service === "visit") return `${r.per_day}× ${r.minutes}-min visits a day`;
  return "Meet & greet";
}

async function loadRequests(status) {
  const list = $("#req-list");
  list.innerHTML = `<p class="muted">Loading…</p>`;
  try {
    const { requests, counts } = await api(`/api/admin/requests?status=${status}`);
    const pending = counts.pending || 0;
    const c = document.getElementById("pending-count");
    c.hidden = !pending;
    c.textContent = pending;
    if (!requests.length) {
      list.innerHTML = `<div class="card center"><div class="icon-badge" style="margin:0 auto 12px">${icon("paw")}</div><p class="muted">Nothing here right now.</p></div>`;
      return;
    }
    list.innerHTML = requests
      .map((r) => {
        const types = (r.pet_types || "").split(",").filter(Boolean);
        const pets = petSummary(types) || types.join(", ");
        const phoneDigits = esc(String(r.phone).replace(/[^\d+]/g, ""));
        return `
        <article class="card req ${esc(r.status)}" data-id="${r.id}">
          <div class="admin-bar">
            <h3 style="margin:0">${esc(r.name)}</h3>
            <span class="pill">${esc(r.status)} · #${r.id}</span>
          </div>
          <p style="margin:8px 0 4px"><strong>${esc(pets)}</strong> · ${describe(r)}</p>
          <p class="meta">${icon("calendar")}<span>${fmt(r.start_date)}${r.end_date !== r.start_date ? ` – ${fmt(r.end_date)}` : ""}</span></p>
          <p class="meta">${icon("pin")}<span>${esc(r.town || "")} ${esc(r.zip)}${r.county === "dc" ? " (DC +50%)" : ""}</span></p>
          ${r.pets ? `<p class="meta">${icon("paw")}<span>${esc(r.pets)}</span></p>` : ""}
          ${r.notes ? `<p class="meta">${icon("message")}<span>${esc(r.notes)}</span></p>` : ""}
          <p style="margin:10px 0">
            ${r.new_client ? `<span class="pill clay">New client · meet &amp; greet</span>` : ""}
            ${r.age_flag ? `<span class="pill clay">Puppy/senior · custom quote</span>` : ""}
          </p>
          <p class="muted small">Website estimate: <strong>${r.estimate != null ? money(r.estimate) : "custom"}</strong> · requested ${esc(r.created_at)} UTC</p>
          <label for="n-${r.id}" class="small">Private notes</label>
          <textarea id="n-${r.id}" rows="2" data-notes>${esc(r.admin_notes || "")}</textarea>
          <div class="actions">
            <a class="btn sm forest" href="sms:${phoneDigits}">${icon("message")}Text</a>
            <a class="btn sm outline" href="tel:${phoneDigits}">${icon("phone")}Call</a>
            <a class="btn sm outline" href="mailto:${esc(r.email)}">${icon("mail")}Email</a>
            ${r.status !== "approved" ? `<button class="btn sm" data-set="approved">Approve</button>` : `<button class="btn sm outline" data-set="done">Mark done</button>`}
            ${r.status !== "declined" ? `<button class="btn sm outline" data-set="declined">Decline</button>` : `<button class="btn sm outline" data-set="pending">Back to pending</button>`}
            <button class="btn sm outline" data-save>Save notes</button>
            ${r.status === "approved" || r.status === "done" ? `<button class="btn sm forest" data-new-report data-email="${esc(r.email)}" data-request="${r.id}" data-name="${esc(r.name)}" data-start="${r.start_date}" data-end="${r.end_date}">${icon("camera")}Visit report</button>` : ""}
            <button class="btn sm outline" data-client="${esc(r.email)}">${icon("user")}${r.client_id ? "Pets &amp; profile" : "Client history"}</button>
          </div>
        </article>`;
      })
      .join("");
  } catch (e) {
    list.innerHTML = `<div class="card">${esc(e.message)}</div>`;
  }
}

$("#req-list").addEventListener("click", async (e) => {
  const card = e.target.closest(".req");
  if (!card) return;
  const clientBtn = e.target.closest("[data-client]");
  if (clientBtn) return openClient(clientBtn.dataset.client, true);
  const reportBtn = e.target.closest("[data-new-report]");
  if (reportBtn) return openReportForm(reportBtn.dataset);
  const id = Number(card.dataset.id);
  const notes = card.querySelector("[data-notes]").value;
  try {
    if (e.target.dataset.set) {
      await api("/api/admin/requests", { method: "PATCH", body: { id, status: e.target.dataset.set, admin_notes: notes } });
      toast(e.target.dataset.set === "approved" ? "Approved. Don't forget to text them!" : "Updated");
      loadRequests(current);
    } else if (e.target.hasAttribute("data-save")) {
      await api("/api/admin/requests", { method: "PATCH", body: { id, admin_notes: notes } });
      toast("Notes saved");
    }
  } catch (err) {
    toast(err.message);
  }
});

// ───────── Calendar ─────────
let month = new Date();
month.setDate(1);
let monthData = { blocked: [], booked: [] };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function loadCalendar() {
  const key = ymd(month).slice(0, 7);
  $("#cal-title").textContent = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  try {
    monthData = await api(`/api/admin/availability?month=${key}`);
  } catch (e) {
    $("#cal").innerHTML = `<p>${esc(e.message)}</p>`;
    return;
  }
  const blocked = new Set(monthData.blocked.map((b) => b.date));
  const today = ymd(new Date());
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  let html = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<div class="dow">${d}</div>`).join("");
  for (let i = 0; i < month.getDay(); i++) html += `<div class="empty"></div>`;
  for (let d = 1; d <= days; d++) {
    const date = `${key}-${String(d).padStart(2, "0")}`;
    const booked = monthData.booked.some((b) => b.start_date <= date && b.end_date >= date);
    const cls = [blocked.has(date) && "blocked", booked && "booked", date === today && "today"].filter(Boolean).join(" ");
    html += `<button class="${cls}" data-date="${date}">${d}</button>`;
  }
  $("#cal").innerHTML = html;
}

$("#cal").addEventListener("click", async (e) => {
  const date = e.target.dataset?.date;
  if (!date) return;
  const isBlocked = e.target.classList.contains("blocked");
  const bookings = monthData.booked.filter((b) => b.start_date <= date && b.end_date >= date);
  $("#day-detail").innerHTML = `
    <h3>${fmt(date)}</h3>
    ${bookings.length ? bookings.map((b) => `<p><strong>${esc(b.name)}</strong> · ${describe(b)} · ${esc(b.town || "")}</p>`).join("") : `<p class="muted">No approved bookings.</p>`}
    <button class="btn small ${isBlocked ? "forest" : ""}" id="toggle-day">${isBlocked ? "Mark available" : "Block this day"}</button>`;
  $("#toggle-day").onclick = async () => {
    try {
      await api("/api/admin/availability", { method: "POST", body: { date, blocked: !isBlocked } });
      toast(isBlocked ? "Day opened up" : "Day blocked");
      $("#day-detail").innerHTML = "";
      loadCalendar();
    } catch (err) {
      toast(err.message);
    }
  };
});
$("#prev").onclick = () => { month.setMonth(month.getMonth() - 1); loadCalendar(); };
$("#next").onclick = () => { month.setMonth(month.getMonth() + 1); loadCalendar(); };

// ───────── Clients ─────────
let clients = [];
const STATUS_LABEL = { pending: "Waiting", approved: "Confirmed", declined: "Declined", done: "Done" };
const petChips = (pets) =>
  pets.map((p) => `<span class="pet-chip">${icon(PETS[p.type]?.icon || "paw")}${esc(p.name)}</span>`).join("");

async function loadClients() {
  const list = $("#clients-list");
  list.innerHTML = `<p class="muted">Loading…</p>`;
  try {
    ({ clients } = await api("/api/admin/clients"));
    renderClients();
  } catch (e) {
    list.innerHTML = `<div class="card">${esc(e.message)}</div>`;
  }
}
function renderClients() {
  const q = $("#client-search").value.trim().toLowerCase();
  const shown = clients.filter((c) =>
    !q || [c.name, c.email, c.phone, c.town, ...c.pets.map((p) => p.name)].some((v) => String(v || "").toLowerCase().includes(q))
  );
  $("#clients-list").innerHTML = shown.length
    ? shown
        .map(
          (c) => `
      <button class="card client-card" data-client="${esc(c.email)}">
        <span class="admin-bar"><strong class="client-name">${c.name ? esc(c.name) : `<em class="muted">Name not added yet</em>`}</strong>
          <span class="pill ${c.client_id ? "" : "grey"}">${c.client_id ? "Account" : "No account yet"}</span></span>
        <span class="muted small client-email">${esc(c.email)}</span>
        <span class="muted small">${esc([c.phone, c.town].filter(Boolean).join(" · "))}</span>
        ${c.pets.length ? `<span class="pet-chips">${petChips(c.pets)}</span>` : ""}
        <span class="muted small">${c.bookings} booking request${c.bookings === 1 ? "" : "s"}${c.pending ? ` · <strong style="color:var(--clay-dark)">${c.pending} waiting</strong>` : ""}</span>
      </button>`
        )
        .join("")
    : `<div class="card center"><p class="muted">${q ? "No clients match that." : "No clients yet. They'll appear here after their first booking request or login."}</p></div>`;
}
$("#client-search").addEventListener("input", renderClients);
$("#clients-list").addEventListener("click", (e) => {
  const b = e.target.closest("[data-client]");
  if (b) openClient(b.dataset.client);
});

const info = (label, value) => (value ? `<div class="info"><span>${label}</span><p>${esc(value)}</p></div>` : "");
async function openClient(email, fromRequests = false) {
  showTab("clients", false);
  $("#clients-list-wrap").hidden = true;
  const box = $("#client-detail");
  box.hidden = false;
  box.innerHTML = `<p class="muted">Loading…</p>`;
  box.dataset.back = fromRequests ? current : "";
  let d;
  try {
    d = await api(`/api/admin/clients?email=${encodeURIComponent(email)}`);
  } catch (e) {
    box.innerHTML = `<button class="btn sm outline" data-back>‹ Back</button><div class="card" style="margin-top:16px">${esc(e.message)}</div>`;
    return;
  }
  const c = d.client || {};
  const name = c.name || d.fromBookings?.name;
  const phone = c.phone || d.fromBookings?.phone || "";
  const digits = esc(String(phone).replace(/[^\d+]/g, ""));
  box.innerHTML = `
    <button class="btn sm outline" data-back>‹ ${fromRequests ? "Back to requests" : "All clients"}</button>
    <div class="card" style="margin-top:16px">
      <div class="admin-bar"><h2 style="margin:0;font-size:1.8rem">${name ? esc(name) : `<em class="muted">Name not added yet</em>`}</h2>
        <span class="pill ${d.client ? "" : "grey"}">${d.client ? "Account" : "No account yet"}</span></div>
      <p class="muted" style="margin:6px 0 0">${esc(d.email)}${phone ? ` · ${esc(phone)}` : ""}</p>
      <div class="actions" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px">
        ${digits ? `<a class="btn sm forest" href="sms:${digits}">${icon("message")}Text</a><a class="btn sm outline" href="tel:${digits}">${icon("phone")}Call</a>` : ""}
        <a class="btn sm outline" href="mailto:${esc(d.email)}">${icon("mail")}Email</a>
      </div>
      ${d.client ? "" : `<p class="alert" style="margin:18px 0 0">${icon("user")}<span>They haven't set up an account yet. They can log in at <strong>walksforlucy.com/account</strong> with ${esc(d.email)} to add their pets, vet and home details.</span></p>`}
      ${d.client ? `<div class="info-grid">
        ${info("Address", [c.address, c.zip].filter(Boolean).join(", "))}
        ${info("Emergency contact", [c.emergency_name, c.emergency_phone].filter(Boolean).join(" · "))}
        ${info("Vet", [c.vet_name, c.vet_phone].filter(Boolean).join(" · "))}
      </div>${info("Getting in & house notes", c.home_notes)}` : ""}
    </div>
    ${d.pets.length ? `<h3 style="margin:28px 0 12px">Pets</h3><div class="grid pet-grid">${d.pets
      .map(
        (p) => `<div class="card">
          <div class="pet-card-head" style="margin-bottom:8px"><span class="pet-badge">${icon(PETS[p.type]?.icon || "paw")}</span>
            <span class="pet-title-wrap"><strong class="pet-title">${esc(p.name)}</strong><span class="muted small">${esc([PETS[p.type]?.label, p.breed, p.age].filter(Boolean).join(" · "))}</span></span></div>
          ${info("Feeding", p.feeding)}${info("Medications", p.medications)}${info("Personality & habits", p.behavior)}${info("Anything else", p.notes)}
          ${[p.feeding, p.medications, p.behavior, p.notes].some(Boolean) ? "" : `<p class="muted small">No details added yet.</p>`}
        </div>`
      )
      .join("")}</div>` : ""}
    <div class="admin-bar" style="margin:28px 0 12px"><h3 style="margin:0">Visit reports</h3>
      <button class="btn sm forest" data-new-report data-email="${esc(d.email)}" data-name="${esc(name || d.email)}">${icon("camera")}New visit report</button></div>
    <div class="grid" id="client-reports"><p class="muted">Loading…</p></div>
    <h3 style="margin:28px 0 12px">Booking requests</h3>
    ${d.bookings.length ? `<div class="grid">${d.bookings
      .map(
        (b) => `<div class="card booking ${esc(b.status)}" style="padding:16px 20px">
          <div class="admin-bar"><strong>${fmt(b.start_date)}${b.end_date !== b.start_date ? ` – ${fmt(b.end_date)}` : ""}</strong>
            <span class="pill ${b.status === "pending" ? "clay" : b.status === "approved" ? "" : "grey"}">${STATUS_LABEL[b.status] || esc(b.status)}</span></div>
          <p class="muted small" style="margin:6px 0 0">#${b.id} · ${describe(b)}${b.pet_types ? ` · ${esc(petSummary(b.pet_types.split(",")))}` : ""}</p>
        </div>`
      )
      .join("")}</div>` : `<p class="muted">No booking requests yet.</p>`}`;
  loadClientReports(d.email);
}

async function loadClientReports(email) {
  const box = $("#client-reports");
  if (!box) return;
  try {
    const { reports } = await api(`/api/admin/reports?email=${encodeURIComponent(email)}`);
    box.innerHTML = reports.length
      ? reports.map((r) => reportHTML(r, { photoUrl: (id) => `/api/admin/photos?id=${id}`, canDelete: true })).join("")
      : `<p class="muted">No visit reports yet.</p>`;
  } catch (e) {
    box.innerHTML = `<p class="muted">${esc(e.message)}</p>`;
  }
}
enableLightbox($("#client-detail"));
$("#client-detail").addEventListener("click", async (e) => {
  const newReport = e.target.closest("[data-new-report]");
  if (newReport) return openReportForm(newReport.dataset);
  const del = e.target.closest("[data-delete-report]");
  if (del) {
    if (!confirm("Delete this visit report and its photos? The client won't see it any more.")) return;
    try {
      await api("/api/admin/reports", { method: "DELETE", body: { id: Number(del.dataset.deleteReport) } });
      del.closest(".report").remove();
      toast("Report deleted");
    } catch (err) {
      toast(err.message);
    }
    return;
  }
  if (!e.target.closest("[data-back]")) return;
  const back = $("#client-detail").dataset.back;
  if (back) return showTab(back);
  $("#client-detail").hidden = true;
  $("#clients-list-wrap").hidden = false;
});

// ───────── Visit report form ─────────
const dlg = $("#report-dialog");
let reportCtx = null;
let picked = []; // { blob, url }
$("#r-done").innerHTML = CHECKLIST.map(
  ([k, l, i]) => `<input type="checkbox" id="r-${k}" value="${k}"><label for="r-${k}">${icon(i)}${l}</label>`
).join("");

function openReportForm(ds) {
  reportCtx = { email: ds.email, request_id: ds.request ? Number(ds.request) : null };
  const today = ymd(new Date());
  // Default to today during the booking, otherwise its first day
  $("#r-date").value = ds.start && (today < ds.start || today > ds.end) ? ds.start : today;
  $("#r-time").value = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  $("#r-notes").value = "";
  document.querySelectorAll("#r-done input").forEach((i) => (i.checked = false));
  picked.forEach((p) => URL.revokeObjectURL(p.url));
  picked = [];
  renderPicks();
  $("#r-msg").textContent = "";
  $("#report-for").textContent = `For ${ds.name || ds.email}${ds.request ? ` · booking #${ds.request}` : ""}. They'll see it in their account.`;
  dlg.showModal();
}
function renderPicks() {
  $("#r-previews").innerHTML = picked
    .map((p, i) => `<div class="pick"><img src="${p.url}" alt=""><button type="button" data-unpick="${i}" aria-label="Remove photo">${icon("close")}</button></div>`)
    .join("");
  document.querySelector('label[for="r-photos"]').hidden = picked.length >= MAX_PHOTOS;
}
$("#r-photos").addEventListener("change", async (e) => {
  const files = [...e.target.files].slice(0, MAX_PHOTOS - picked.length);
  e.target.value = "";
  $("#r-msg").textContent = files.length ? "Preparing photos…" : "";
  for (const f of files) {
    try {
      const blob = await shrinkPhoto(f);
      picked.push({ blob, url: URL.createObjectURL(blob) });
      renderPicks();
    } catch (err) {
      toast(err.message);
    }
  }
  $("#r-msg").textContent = "";
});
$("#r-previews").addEventListener("click", (e) => {
  const b = e.target.closest("[data-unpick]");
  if (!b) return;
  const [p] = picked.splice(Number(b.dataset.unpick), 1);
  URL.revokeObjectURL(p.url);
  renderPicks();
});
dlg.addEventListener("click", (e) => {
  if (e.target.closest("[data-close]") || e.target === dlg) dlg.close();
});
$("#report-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#r-msg");
  const btn = $("#report-form button[type=submit]");
  const done = [...document.querySelectorAll("#r-done input:checked")].map((i) => i.value);
  const notes = $("#r-notes").value.trim();
  if (!$("#r-date").value) return (msg.textContent = "Please pick the date.");
  if (!done.length && !notes && !picked.length) return (msg.textContent = "Add a note, a photo or tick what you did.");
  btn.disabled = true;
  msg.textContent = "Posting…";
  try {
    const { id } = await api("/api/admin/reports", {
      method: "POST",
      body: { ...reportCtx, visit_date: $("#r-date").value, visit_time: $("#r-time").value, done, notes, photoCount: picked.length },
    });
    let failed = 0;
    for (const [i, p] of picked.entries()) {
      msg.textContent = `Uploading photo ${i + 1} of ${picked.length}…`;
      const r = await fetch(`/api/admin/photos?report=${id}`, { method: "POST", headers: { "content-type": "image/jpeg" }, body: p.blob });
      if (!r.ok) failed++;
    }
    dlg.close();
    toast(failed ? `Posted, but ${failed} photo${failed > 1 ? "s" : ""} didn't upload` : "Visit report posted");
    if (!$("#client-detail").hidden) loadClientReports(reportCtx.email);
  } catch (err) {
    msg.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

// ───────── Tabs ─────────
function showTab(tab, load = true) {
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  $("#cal-view").hidden = tab !== "calendar";
  $("#clients-view").hidden = tab !== "clients";
  $("#list-view").hidden = tab === "calendar" || tab === "clients";
  if (!load) return;
  if (tab === "calendar") loadCalendar();
  else if (tab === "clients") {
    $("#client-detail").hidden = true;
    $("#clients-list-wrap").hidden = false;
    loadClients();
  } else loadRequests((current = tab));
}
$("#tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tab]");
  if (b) showTab(b.dataset.tab);
});

loadRequests(current);
