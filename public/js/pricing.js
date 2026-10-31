// ─────────────────────────────────────────────────────────────
//  Purfect Pet — ALL PRICES LIVE HERE.
//  Change a number here and the website + estimator update.
// ─────────────────────────────────────────────────────────────

export const BUSINESS = {
  name: "Purfect Pet",
  owner: "Anissa",
  phone: "541-801-1068",
  phoneHref: "+15418011068",
  since: 2019,
  home: { name: "Reston, VA", lat: 38.9586, lng: -77.357 },
  visitRadiusMiles: 6,
};

// Drop-in visits (walks, potty breaks, feeding, cat care…)
export const VISITS = [
  { minutes: 15, price: 10, label: "15 min", note: "Quick potty break" },
  { minutes: 30, price: 17, label: "30 min", note: "Walk + feeding, cat care" },
  { minutes: 60, price: 30, label: "1 hour", note: "Long adventure walk + play" },
];

// Overnights / house sitting (priced per night)
export const OVERNIGHTS = [
  { hours: 10, price: 50, label: "10 hrs with your pet" },
  { hours: 12, price: 60, label: "12 hrs with your pet" },
  { hours: 20, price: 80, label: "20 hrs with your pet" },
  { hours: 24, price: 120, label: "24 hrs with your pet" },
];

export const MAX_HOURS_AWAY = 5; // Anissa is never away from your pet longer than this during an overnight

// Pet types. minVisit = shortest visit allowed (in minutes).
export const PETS = {
  dog:        { label: "Dog",        emoji: "🐶", minVisit: 15 },
  cat:        { label: "Cat",        emoji: "🐱", minVisit: 30 },
  bird:       { label: "Bird",       emoji: "🐦", minVisit: 30 },
  guineapig:  { label: "Guinea pig", emoji: "🐹", minVisit: 30 },
  turtle:     { label: "Turtle",     emoji: "🐢", minVisit: 30 },
  other:      { label: "Other",      emoji: "🐾", minVisit: 30 },
};

// Any visit that includes feeding must be at least this long
export const FEEDING_MIN_MINUTES = 30;

// Meet & greet (pre-visit) by county
export const MEET_AND_GREET = { fairfax: 0, loudoun: 10 }; // DC: ask Anissa

// Washington, DC: overnights only, +50%
export const DC_UPCHARGE = 0.5;

// Included free with every visit / stay
export const INCLUDED = [
  "Photo updates every visit",
  "Min. 2 photo updates a day on overnights",
  "Videos on request",
  "Fresh water & feeding",
  "Playtime & cuddles",
  "Litter box scooping",
  "Taking out the trash",
  "Watering plants",
  "House sitting: keeping an eye on things",
];

/**
 * Estimate a price.
 * @param {object} o
 *   o.service   "visit" | "overnight"
 *   o.pet       key of PETS
 *   o.minutes   visit length (visit only)
 *   o.hours     overnight length (overnight only)
 *   o.perDay    visits per day (visit only)
 *   o.days      number of days / nights
 *   o.feeding   boolean – visit includes feeding
 *   o.zone      result of classifyZip() (optional)
 *   o.ageFlag   true if any dog is under 1 or over 14
 */
export function estimate(o) {
  const lines = [];
  const warnings = [];
  let total = 0;
  const days = Math.max(1, Number(o.days) || 1);
  const pet = PETS[o.pet] || PETS.dog;
  const zone = o.zone || null;

  if (o.ageFlag) {
    return {
      total: null,
      lines,
      warnings,
      contact: "Puppies under 1 and seniors over 14 get special care, so pricing is custom. Please text Anissa and she'll put together a quote!",
    };
  }

  if (o.service === "overnight") {
    const opt = OVERNIGHTS.find((x) => x.hours === Number(o.hours)) || OVERNIGHTS[0];
    const sub = opt.price * days;
    lines.push({ label: `${opt.label} × ${days} night${days > 1 ? "s" : ""}`, amount: sub });
    total += sub;
  } else {
    let minutes = Number(o.minutes) || 30;
    const minRequired = Math.max(pet.minVisit, o.feeding ? FEEDING_MIN_MINUTES : 0);
    if (minutes < minRequired) {
      warnings.push(`${pet.label} visits${o.feeding ? " with feeding" : ""} are at least ${minRequired} minutes. We bumped it up for you.`);
      minutes = minRequired;
    }
    const opt = VISITS.find((x) => x.minutes === minutes) || VISITS[1];
    const perDay = Math.max(1, Number(o.perDay) || 1);
    const count = perDay * days;
    const sub = opt.price * count;
    lines.push({ label: `${opt.label} visit × ${count} (${perDay}/day for ${days} day${days > 1 ? "s" : ""})`, amount: sub });
    total += sub;
  }

  if (zone) {
    if (zone.area === "dc") {
      if (o.service !== "overnight") {
        warnings.push("In Washington, DC Anissa only does overnights. Switch to an overnight to see the DC price.");
      } else {
        const up = Math.round(total * DC_UPCHARGE * 100) / 100;
        lines.push({ label: "Washington, DC (+50%)", amount: up });
        total += up;
      }
    } else if (zone.area === "outside") {
      warnings.push("That ZIP is outside the usual service area. Text Anissa and she'll let you know if she can make it work!");
    } else if (o.service !== "overnight" && !zone.visitsOk) {
      warnings.push(`Drop-in visits & walks are within about ${BUSINESS.visitRadiusMiles} miles of Reston. That ZIP is ${zone.miles.toFixed(1)} miles out, so ask Anissa, or try an overnight!`);
    }
    const mg = MEET_AND_GREET[zone.county];
    if (mg !== undefined) {
      lines.push({ label: `Meet & greet (${zone.countyLabel})`, amount: mg, free: mg === 0 });
      total += mg;
    }
  }

  return { total, lines, warnings, contact: null };
}

export const money = (n) => (n === 0 ? "FREE" : `$${Number(n).toFixed(Number.isInteger(n) ? 0 : 2)}`);
