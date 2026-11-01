// Shared header, footer and small UI helpers.
import { BUSINESS } from "./pricing.js";

export const icon = (id, cls = "") =>
  `<svg class="i ${cls}" aria-hidden="true" focusable="false"><use href="/img/icons.svg#${id}"/></svg>`;

const links = [
  ["/", "Home"],
  ["/services", "Services"],
  ["/pricing", "Pricing"],
  ["/area", "Service Area"],
  ["/about", "About"],
  ["/lucy", "Lucy's Story"],
  ["/dream", "The Dream"],
  ["/faq", "FAQ"],
];

const here = location.pathname.replace(/(index)?\.html$/, "").replace(/\/$/, "") || "/";

const brand = (tag = true) => `
  <a class="brand" href="/" aria-label="${BUSINESS.name} home">
    <svg class="mark" aria-hidden="true"><use href="/img/icons.svg#logo"/></svg>
    <span><span class="word">Walks <em>for</em> Lucy</span>${tag ? `<span class="tag">Pet care · Reston, VA</span>` : ""}</span>
  </a>`;

const header = document.getElementById("site-header");
if (header) {
  const top = document.createElement("div");
  top.className = "topbar";
  top.innerHTML = `
    <div class="container">
      <span class="hide-sm">Full-time pet care since ${BUSINESS.since} · Now serving Fairfax &amp; Loudoun County</span>
      <a href="tel:${BUSINESS.phoneHref}">${icon("phone")} ${BUSINESS.phone}</a>
    </div>`;
  header.before(top);

  header.className = "site-header";
  header.innerHTML = `
    <nav class="container nav" aria-label="Main">
      ${brand()}
      <button class="nav-toggle" aria-expanded="false" aria-controls="nav-links" aria-label="Open menu">${icon("menu")}</button>
      <ul class="nav-links" id="nav-links">
        ${links.map(([href, label]) => `<li><a href="${href}"${href === here ? ' aria-current="page"' : ""}>${label}</a></li>`).join("")}
        <li><a class="btn sm" href="/book" style="color:#fff">Book a visit</a></li>
      </ul>
    </nav>`;
  const t = header.querySelector(".nav-toggle");
  const l = header.querySelector(".nav-links");
  t.addEventListener("click", () => {
    const open = l.classList.toggle("open");
    t.setAttribute("aria-expanded", open);
    t.innerHTML = icon(open ? "close" : "menu");
  });
}

const footer = document.getElementById("site-footer");
if (footer) {
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          ${brand()}
          <p style="margin-top:18px;max-width:34em">Dedicated, full-time dog walking and pet sitting by Anissa: walks, drop-in visits and overnights across Fairfax &amp; Loudoun County. Named in loving memory of Lucy.</p>
        </div>
        <div>
          <h4>Explore</h4>
          <ul>${[...links.slice(1), ["/book", "Book a visit"]].map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join("")}</ul>
        </div>
        <div class="contact">
          <h4>Get in touch</h4>
          <ul>
            <li><a href="sms:${BUSINESS.phoneHref}">${icon("message")} Text ${BUSINESS.phone}</a></li>
            <li><a href="tel:${BUSINESS.phoneHref}">${icon("phone")} Call Anissa</a></li>
            <li><a href="/book">${icon("calendar")} Request a visit</a></li>
          </ul>
        </div>
      </div>
      <div class="copyright">
        <span>© ${new Date().getFullYear()} ${BUSINESS.name} · ${BUSINESS.domain}</span>
        <span>Reston, Virginia</span>
      </div>
    </div>`;
}

// Floating "text Anissa" button
if (!location.pathname.startsWith("/admin") && !document.querySelector(".fab")) {
  const a = document.createElement("a");
  a.className = "fab";
  a.href = `sms:${BUSINESS.phoneHref}`;
  a.setAttribute("aria-label", `Text Anissa at ${BUSINESS.phone}`);
  a.innerHTML = `${icon("message")}<span>Text Anissa</span>`;
  document.body.appendChild(a);
}

// Gentle fade-in as sections scroll into view
const io = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))), { rootMargin: "0px 0px -8% 0px" })
  : null;
document.querySelectorAll(".reveal").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));
