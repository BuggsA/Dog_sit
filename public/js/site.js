// Shared header + footer so every page stays in sync.
import { BUSINESS } from "./pricing.js";

const links = [
  ["/", "Home"],
  ["/pricing", "Pricing & Estimate"],
  ["/area", "Service Area"],
  ["/about", "Meet Anissa"],
  ["/book", "Book a Visit"],
];

const here = location.pathname.replace(/(index)?\.html$/, "").replace(/\/$/, "") || "/";

const header = document.getElementById("site-header");
if (header) {
  header.className = "site-header";
  header.innerHTML = `
    <nav class="container nav" aria-label="Main">
      <a class="brand" href="/"><span class="logo" aria-hidden="true">🐾</span><span>Pur<b>fect</b> Pet</span></a>
      <button class="nav-toggle" aria-expanded="false" aria-controls="nav-links" aria-label="Menu">☰</button>
      <ul class="nav-links" id="nav-links">
        ${links
          .map(([href, label]) => {
            const cur = href === here ? ' aria-current="page"' : "";
            const cls = href === "/book" ? ' class="btn small" style="color:#fff"' : "";
            return `<li><a href="${href}"${cur}${cls}>${label}</a></li>`;
          })
          .join("")}
      </ul>
    </nav>`;
  const t = header.querySelector(".nav-toggle");
  const l = header.querySelector(".nav-links");
  t.addEventListener("click", () => {
    const open = l.classList.toggle("open");
    t.setAttribute("aria-expanded", open);
  });
}

const footer = document.getElementById("site-footer");
if (footer) {
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <div class="brand"><span aria-hidden="true">🐾</span> Purfect Pet</div>
          <p>Loving, dedicated pet care in Reston, Fairfax &amp; Loudoun County since ${BUSINESS.since}.</p>
        </div>
        <div>
          <h3>Say hi 👋</h3>
          <p>Text or call Anissa<br><a href="sms:${BUSINESS.phoneHref}">${BUSINESS.phone}</a></p>
        </div>
        <div>
          <h3>Quick links</h3>
          <p>${links.map(([h, l]) => `<a href="${h}">${l}</a>`).join("<br>")}</p>
        </div>
      </div>
      <p class="copyright">© ${new Date().getFullYear()} Purfect Pet · purfect-pet.com · Made with love (and lots of treats) 🦴</p>
    </div>`;
}

// Floating "text Anissa" button
if (!document.querySelector(".fab") && !location.pathname.startsWith("/admin")) {
  const a = document.createElement("a");
  a.className = "fab";
  a.href = `sms:${BUSINESS.phoneHref}`;
  a.title = "Text Anissa";
  a.setAttribute("aria-label", `Text Anissa at ${BUSINESS.phone}`);
  a.textContent = "💬";
  document.body.appendChild(a);
}
