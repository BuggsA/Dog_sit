// Calendar files (.ics) that iPhone, Android, Google and Outlook calendars understand.
// Bookings have dates but no set times, so they're all-day events.

const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const ymd = (d) => d.replace(/-/g, "");
/** The day after YYYY-MM-DD (calendar all-day events end the day after). */
export const nextDay = (d) => {
  const t = new Date(d + "T12:00:00Z");
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};
// Lines over 75 bytes are folded, as the calendar format requires
const fold = (line) => {
  const out = [];
  let cur = "";
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 74) {
      out.push(cur);
      cur = " " + ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
};

/** events: [{ uid, start: "YYYY-MM-DD", end: "YYYY-MM-DD" (inclusive last day), summary, description?, location? }] */
export function calendar(name, events, { refreshHours = 0 } = {}) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Walks for Lucy//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    "X-WR-TIMEZONE:America/New_York",
    ...(refreshHours ? [`REFRESH-INTERVAL;VALUE=DURATION:PT${refreshHours}H`, `X-PUBLISHED-TTL:PT${refreshHours}H`] : []),
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@walksforlucy.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(e.start)}`,
      `DTEND;VALUE=DATE:${ymd(nextDay(e.end))}`,
      `SUMMARY:${esc(e.summary)}`,
      ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
      ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
      "TRANSP:TRANSPARENT",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export const icsResponse = (body, filename, { download = false } = {}) =>
  new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });

/** "2× 30-min visits a day" / "Overnights, 12 hrs a day" / "Meet & greet" */
export const serviceText = (b) =>
  b.service === "overnight" ? `Overnights, ${b.hours} hrs a day` : b.service === "visit" ? `${b.per_day}× ${b.minutes}-min visits a day` : "Meet & greet";
