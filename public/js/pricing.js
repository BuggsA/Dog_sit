// ─────────────────────────────────────────────────────────────
//  Walks for Lucy: ALL PRICES & RULES LIVE HERE.
//  Change a number here and the website, estimator and
//  booking estimates all update.
// ─────────────────────────────────────────────────────────────

export const BUSINESS = {
  name: "Walks for Lucy",
  domain: "walksforlucy.com",
  owner: "Anissa",
  phone: "(541) 801-1068",
  phoneHref: "+15418011068",
  since: 2019,
  // Shown on clients' bills. Add Anissa's Venmo / Zelle details here.
  payNote: "Pay Anissa by Venmo, Zelle, cash or check. Please include the bill number so she can mark it paid.",
};

// Ways a bill can be paid (Anissa picks one when she marks it paid)
export const PAY_METHODS = ["Cash", "Venmo", "Zelle", "Check", "Card", "Other"];

/** $17 or $17.50 (bills always show a dollar amount, never "Free") */
export const dollars = (n) => {
  const v = Math.round(Number(n || 0) * 100) / 100;
  return `${v < 0 ? "−" : ""}$${Math.abs(v).toFixed(Number.isInteger(v) ? 0 : 2)}`;
};

// Drop-in visits (walks, potty breaks, feeding, cat care…)
export const VISITS = [
  { minutes: 15, price: 10, label: "15 minutes", note: "A quick potty break" },
  { minutes: 30, price: 17, label: "30 minutes", note: "Walk and feeding, or cat & small-pet care" },
  { minutes: 60, price: 30, label: "1 hour", note: "A long walk with plenty of playtime" },
];

// Overnights / house sitting (priced per night)
export const OVERNIGHTS = [
  { hours: 10, price: 50, label: "10 hours", note: "Evening through morning" },
  { hours: 12, price: 60, label: "12 hours", note: "Evening through late morning" },
  { hours: 20, price: 80, label: "20 hours", note: "Most of the day and night" },
  { hours: 24, price: 120, label: "24 hours", note: "Round-the-clock company" },
];

export const MAX_HOURS_AWAY = 5; // never away from your pet longer than this during an overnight

// Pet types: icon = id in /img/icons.svg; minVisit = shortest visit allowed (minutes)
export const PETS = {
  dog:       { label: "Dog",        noun: "dog",        plural: "dogs",        icon: "dog",       minVisit: 15 },
  cat:       { label: "Cat",        noun: "cat",        plural: "cats",        icon: "cat",       minVisit: 30 },
  bird:      { label: "Bird",       noun: "bird",       plural: "birds",       icon: "bird",      minVisit: 30 },
  guineapig: { label: "Guinea pig", noun: "guinea pig", plural: "guinea pigs", icon: "guineapig", minVisit: 30 },
  turtle:    { label: "Turtle",     noun: "turtle",     plural: "turtles",     icon: "turtle",    minVisit: 30 },
  other:     { label: "Other",      noun: "other pet",  plural: "other pets",  icon: "paw",       minVisit: 30 },
};

// Most pets one booking request can list
export const MAX_PETS = 10;

/** ["dog","dog","cat"] → "2 dogs and 1 cat" */
export function petSummary(types) {
  const counts = {};
  for (const t of types) if (PETS[t]) counts[t] = (counts[t] || 0) + 1;
  const parts = Object.keys(PETS)
    .filter((k) => counts[k])
    .map((k) => `${counts[k]} ${counts[k] > 1 ? PETS[k].plural : PETS[k].noun}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0] || "";
}

// Any visit that includes feeding must be at least this long
export const FEEDING_MIN_MINUTES = 30;

// Visits for more than one pet must be at least this long (the price doesn't change with the number of pets)
export const MULTI_PET_MIN_MINUTES = 30;

/**
 * Shortest visit allowed for these pets (one entry per animal, e.g. ["dog","dog"]),
 * plus a short reason to show when it's longer than 15 minutes.
 */
export function minVisitFor(pets, feeding = false) {
  const list = pets.filter((p) => PETS[p]);
  const strict = list.reduce((a, p) => (!a || PETS[p].minVisit > PETS[a].minVisit ? p : a), null);
  const rules = [
    [strict ? PETS[strict].minVisit : 15, strict && `${PETS[strict].label} visits are at least ${PETS[strict].minVisit} minutes.`],
    [list.length > 1 ? MULTI_PET_MIN_MINUTES : 0, `Visits for more than one pet are at least ${MULTI_PET_MIN_MINUTES} minutes.`],
    [feeding ? FEEDING_MIN_MINUTES : 0, `Visits with feeding are at least ${FEEDING_MIN_MINUTES} minutes.`],
  ];
  const minutes = Math.max(...rules.map((r) => r[0]));
  return { minutes, reason: minutes > 15 ? rules.find((r) => r[0] === minutes)[1] : "" };
}

// Meet & greet before the first booking, by county (DC: ask Anissa)
export const MEET_AND_GREET = { fairfax: 0, loudoun: 10 };

// Washington, DC: overnights only, +50%
export const DC_UPCHARGE = 0.5;

// Included with every visit or stay  [icon, text]
export const INCLUDED = [
  ["camera", "Photo updates every visit"],
  ["video", "Videos on request"],
  ["bowl", "Fresh food & water"],
  ["ball", "Playtime & cuddles"],
  ["litter", "Litter boxes scooped"],
  ["trash", "Trash taken out"],
  ["plant", "Plants watered"],
  ["home", "An eye on the house"],
];

/**
 * Estimate a price.
 *   o.service "visit" | "overnight"; o.pets list of PETS keys, one per animal
 *   (or o.pet for a single pet); o.minutes; o.hours;
 *   o.perDay; o.days; o.feeding; o.zone (classifyZip result); o.ageFlag
 */
export function estimate(o) {
  const lines = [];
  const warnings = [];
  let total = 0;
  const days = Math.max(1, Number(o.days) || 1);
  const pets = (Array.isArray(o.pets) && o.pets.length ? o.pets : [o.pet]).filter((p) => PETS[p]);
  if (!pets.length) pets.push("dog");
  const zone = o.zone || null;

  if (o.ageFlag) {
    return {
      total: null,
      lines,
      warnings,
      contact: "Puppies under 1 and seniors over 14 get extra care, so their pricing is custom. Send Anissa a quick text and she'll put together a quote.",
    };
  }

  if (o.service === "overnight") {
    const opt = OVERNIGHTS.find((x) => x.hours === Number(o.hours)) || OVERNIGHTS[0];
    const sub = opt.price * days;
    lines.push({ label: `${opt.label} × ${days} night${days > 1 ? "s" : ""}`, amount: sub });
    total += sub;
  } else {
    let minutes = Number(o.minutes) || 30;
    const { minutes: minRequired, reason } = minVisitFor(pets, o.feeding);
    if (minutes < minRequired) {
      warnings.push(`${reason.replace(/\.$/, "")}, so we've adjusted the length.`);
      minutes = minRequired;
    }
    const opt = VISITS.find((x) => x.minutes === minutes) || VISITS[1];
    const perDay = Math.max(1, Number(o.perDay) || 1);
    const count = perDay * days;
    const sub = opt.price * count;
    lines.push({ label: `${count} × ${opt.label} visit${count > 1 ? "s" : ""}`, amount: sub });
    total += sub;
  }

  if (zone) {
    if (zone.area === "dc") {
      if (o.service !== "overnight") {
        warnings.push("In Washington, DC, Anissa offers overnights only. Switch to an overnight to see DC pricing.");
      } else {
        const up = Math.round(total * DC_UPCHARGE * 100) / 100;
        lines.push({ label: "Washington, DC (+50%)", amount: up });
        total += up;
      }
    } else if (zone.area === "outside") {
      warnings.push("That ZIP code is outside the usual service area. Text Anissa and she'll let you know if she can help.");
    } else if (o.service !== "overnight" && !zone.visitsOk) {
      warnings.push("Walks and drop-in visits cover about a 20-minute drive from Reston. That ZIP is a bit further out, so it's best for overnights. Text Anissa to ask about visits.");
    }
    const mg = MEET_AND_GREET[zone.county];
    if (mg !== undefined) {
      lines.push({ label: `Meet & greet (${zone.countyLabel})`, amount: mg });
      total += mg;
    }
  }

  return { total, lines, warnings, contact: null };
}

export const money = (n) => (n === 0 ? "Free" : `$${Number(n).toFixed(Number.isInteger(n) ? 0 : 2)}`);
