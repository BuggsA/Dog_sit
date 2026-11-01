// Visit report checklist: shared by Anissa's dashboard, the client's account page and the server.
// [key, label, icon id in /img/icons.svg]
export const CHECKLIST = [
  ["walk", "Walk", "leash"],
  ["fed", "Fed", "bowl"],
  ["water", "Fresh water", "bowl"],
  ["meds", "Meds given", "heart"],
  ["pee", "Pee", "tick"],
  ["poop", "Poop", "tick"],
  ["litter", "Litter scooped", "litter"],
  ["play", "Playtime", "ball"],
  ["home", "House checked", "home"],
];
export const MAX_PHOTOS = 10;

// ───────── Browser helpers (only run in the page, never on the server) ─────────
const ic = (id) => `<svg class="i" aria-hidden="true"><use href="/img/icons.svg#${id}"/></svg>`;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const LABELS = Object.fromEntries(CHECKLIST.map(([k, l, i]) => [k, [l, i]]));

/** One visit report card. photoUrl(id) gives each photo's address. */
export function reportHTML(r, { photoUrl, canDelete = false }) {
  const date = new Date(r.visit_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return `
    <article class="card report" data-report-id="${r.id}">
      <div class="admin-bar">
        <h3 style="margin:0">${date}${r.visit_time ? ` <span class="muted small">· ${esc(r.visit_time)}</span>` : ""}</h3>
        ${canDelete ? `<button class="btn sm outline" type="button" data-delete-report="${r.id}">Delete</button>` : ""}
      </div>
      ${r.done.length ? `<div class="done-list">${r.done.map((k) => LABELS[k] ? `<span class="done">${ic(LABELS[k][1])}${LABELS[k][0]}</span>` : "").join("")}</div>` : ""}
      ${r.notes ? `<p class="report-notes">${esc(r.notes)}</p>` : ""}
      ${r.photos.length ? `<div class="photo-grid">${r.photos
        .map((id) => `<button type="button" class="photo" data-full="${photoUrl(id)}" aria-label="Open photo"><img src="${photoUrl(id)}" alt="Photo from the visit" loading="lazy"></button>`)
        .join("")}</div>` : ""}
    </article>`;
}

/** Tap a photo to see it full size. */
export function enableLightbox(root) {
  let dlg = document.getElementById("lightbox");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "lightbox";
    dlg.className = "lightbox";
    dlg.innerHTML = `<img alt="Photo from the visit"><button type="button" class="lightbox-close" aria-label="Close">${ic("close")}</button>`;
    dlg.addEventListener("click", () => dlg.close());
    document.body.append(dlg);
  }
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-full]");
    if (!b) return;
    dlg.querySelector("img").src = b.dataset.full;
    dlg.showModal();
  });
}

/** Shrink a phone photo to at most 1600px on the long side as a JPEG, so uploads are quick and storage stays small. */
export async function shrinkPhoto(file, max = 1600) {
  let src;
  try {
    src = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    src = await new Promise((ok, fail) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => fail(new Error("Couldn't read that photo"));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = src.width, h = src.height;
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d").drawImage(src, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("Couldn't process that photo"))), "image/jpeg", 0.82));
}
