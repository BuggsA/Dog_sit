// Shared by Anissa's dashboard and the client's account page: message threads and bill cards.
import { dollars } from "./pricing.js";

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ic = (id) => `<svg class="i" aria-hidden="true"><use href="/img/icons.svg#${id}"/></svg>`;

/** Database times are UTC "YYYY-MM-DD HH:MM:SS". */
export const when = (s) => {
  const d = new Date(String(s).replace(" ", "T") + "Z");
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};
const day = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// ───────── Messages ─────────
/** me = "client" | "anissa": my messages sit on the right. */
export function threadHTML(messages, me, otherName) {
  if (!messages.length)
    return `<p class="muted center chat-empty">${me === "client" ? "Questions about a visit, keys, a schedule change? Send Anissa a message here." : `No messages with ${esc(otherName)} yet.`}</p>`;
  const last = messages.at(-1);
  return messages
    .map(
      (m) => `<div class="bubble ${m.sender === me ? "mine" : "theirs"}">
        <p>${esc(m.body)}</p>
        <span class="bubble-meta">${m.sender === me ? "You" : esc(otherName)} · ${when(m.created_at)}${m === last && m.sender === me && m.read_at ? " · Seen" : ""}</span>
      </div>`
    )
    .join("");
}

/** Wires up a compose box: Enter adds a line, Ctrl/⌘+Enter sends. */
export function wireCompose(form, onSend) {
  const box = form.querySelector("textarea");
  const btn = form.querySelector("button[type=submit]");
  const go = async () => {
    const body = box.value.trim();
    if (!body) return;
    btn.disabled = true;
    try {
      await onSend(body);
      box.value = "";
    } finally {
      btn.disabled = false;
      box.focus();
    }
  };
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    go();
  });
  box.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      go();
    }
  });
}

// ───────── Bills ─────────
export function billHTML(b, { admin = false, name = "" } = {}) {
  const status =
    b.status === "paid"
      ? `<span class="pill">Paid${b.paid_method ? ` · ${esc(b.paid_method)}` : ""}</span>`
      : b.status === "void"
        ? `<span class="pill grey">Cancelled</span>`
        : `<span class="pill clay">${b.due_date && b.due_date < new Date().toISOString().slice(0, 10) ? "Overdue" : "To pay"}</span>`;
  return `
    <article class="card bill ${esc(b.status)}" data-bill="${b.id}">
      <div class="admin-bar">
        <h3 style="margin:0">Bill #${b.id}${admin && name ? ` · ${esc(name)}` : ""}</h3>
        ${status}
      </div>
      <p class="muted small" style="margin:6px 0 0">${day(b.created_at.slice(0, 10))}${b.request_id ? ` · booking #${b.request_id}` : ""}${b.due_date && b.status === "unpaid" ? ` · due ${day(b.due_date)}` : ""}${b.status === "paid" && b.paid_at ? ` · paid ${day(b.paid_at.slice(0, 10))}` : ""}</p>
      <table class="bill-lines">${b.lines.map((l) => `<tr><td>${esc(l.label)}</td><td>${dollars(l.amount)}</td></tr>`).join("")}
        <tr class="bill-total"><td>Total</td><td>${dollars(b.total)}</td></tr></table>
      ${b.note ? `<p class="small" style="margin:10px 0 0">${esc(b.note)}</p>` : ""}
      ${admin ? `<div class="bill-actions">${
        b.status === "unpaid"
          ? `<label class="sr-only" for="pm-${b.id}">Paid by</label><select id="pm-${b.id}" data-method>${["Cash", "Venmo", "Zelle", "Check", "Card", "Other"].map((m) => `<option>${m}</option>`).join("")}</select>
             <button class="btn sm forest" data-bill-set="paid">${ic("check")}Mark paid</button>
             <button class="btn sm outline" data-bill-set="void">Cancel bill</button>`
          : `<button class="btn sm outline" data-bill-set="unpaid">Mark unpaid</button>`
      }</div>` : ""}
    </article>`;
}
