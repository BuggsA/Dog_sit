import { PETS, money } from "./pricing.js";
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
        const pets = (r.pet_types || "").split(",").filter(Boolean).map((p) => PETS[p]?.label || p).join(", ");
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

// ───────── Tabs ─────────
$("#tabs").addEventListener("click", (e) => {
  const tab = e.target.dataset.tab;
  if (!tab) return;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b === e.target));
  const cal = tab === "calendar";
  $("#cal-view").hidden = !cal;
  $("#list-view").hidden = cal;
  if (cal) loadCalendar();
  else loadRequests((current = tab));
});

loadRequests(current);
