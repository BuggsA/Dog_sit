import { test } from "node:test";
import assert from "node:assert/strict";
import { estimate } from "../public/js/pricing.js";
import { classifyZip } from "../public/js/zones.js";

test("dog 15 min visit, Reston, free meet & greet", () => {
  const r = estimate({ service: "visit", pet: "dog", minutes: 15, perDay: 1, days: 1, zone: classifyZip("20190") });
  assert.equal(r.total, 10);
});
test("feeding bumps dog visit to 30 min", () => {
  const r = estimate({ service: "visit", pet: "dog", minutes: 15, perDay: 2, days: 2, feeding: true });
  assert.equal(r.total, 17 * 4);
});
test("cats are at least 30 min", () => {
  assert.equal(estimate({ service: "visit", pet: "cat", minutes: 15, perDay: 1, days: 1 }).total, 17);
});
test("overnights", () => {
  for (const [h, p] of [[10, 50], [12, 60], [20, 80], [24, 120]])
    assert.equal(estimate({ service: "overnight", pet: "dog", hours: h, days: 2 }).total, p * 2);
});
test("Loudoun meet & greet is $10", () => {
  const r = estimate({ service: "overnight", pet: "dog", hours: 12, days: 1, zone: classifyZip("20147") });
  assert.equal(r.total, 70);
});
test("DC overnights +50%, visits warn", () => {
  const dc = classifyZip("20003");
  assert.equal(dc.area, "dc");
  assert.equal(estimate({ service: "overnight", pet: "dog", hours: 24, days: 1, zone: dc }).total, 180);
  assert.ok(estimate({ service: "visit", pet: "dog", minutes: 30, days: 1, zone: dc }).warnings.length);
});
test("puppies/seniors need a custom quote", () => {
  assert.equal(estimate({ service: "visit", pet: "dog", ageFlag: true }).total, null);
});
test("zones", () => {
  assert.equal(classifyZip("20170").visitsOk, true);   // Herndon
  assert.equal(classifyZip("20105").area, "inside");   // Aldie (Virginia, not DC!)
  assert.equal(classifyZip("20105").visitsOk, false);
  assert.equal(classifyZip("90210").area, "outside");
  assert.equal(classifyZip("abc"), null);
});
