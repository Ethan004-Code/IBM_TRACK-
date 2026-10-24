import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as limits from "./limits.js";
import * as allergens from "./allergens.js";

function ui(fetchImpl = async () => { throw Error("Unexpected network request"); }) {
  const nodes = new Map();
  const document = {
    querySelector(sel) {
      if (sel === "#review-panel") return null;
      if (!nodes.has(sel)) nodes.set(sel, {
        innerHTML: "", hidden: true, style: {}, addEventListener() {},
        classList: { toggle() {} }, contains() { return false; },
      });
      return nodes.get(sel);
    },
    addEventListener() {},
  };
  const context = vm.createContext({
    ...limits, ...allergens, document, fetch: fetchImpl, Date, Intl, URL,
    createDonationMap() {}, setInterval() {}, setTimeout() {},
  });
  const source = fs.readFileSync(new URL("./new.js", import.meta.url), "utf8")
    .replace(/^import .*;$/gm, "").split("\ninitialize();")[0];
  vm.runInContext(source + `
    globalThis.ui = { S, viewImpact, refreshImpact, conditionOptions,
      viewCompose, viewReview, onBind, readDraft, signedOut,
      spotField, viewDiscover, giveawayBody, giveawayBlock, viewActivity, listingCard, actions };
  `, context);
  return { ...context.ui, nodes };
}

test("signed out impact has sign-in button, no totals, and makes no impact request", async () => {
  const app = ui();
  const html = app.viewImpact();
  assert.match(html, /Your impact/);
  assert.match(html, /Sign in to see your impact/);
  assert.match(html, /data-action="open-signin"/);
  assert.doesNotMatch(html, /class="stat/);
  await app.refreshImpact();
  assert.equal(app.S.impact, null);
});

test("signed in all-zero impact has the exact requested message", () => {
  const app = ui();
  app.S.user = { id: "a", display_name: "A" };
  app.S.impact = { completed_trades: 0, completed_giveaways: 0, donations_reported: 0, compost_reported: 0 };
  assert.match(app.viewImpact(), /No completed handoffs yet\. Share or pick up food to get started\./);
});

test("nonzero personal impact renders own counts without the empty message", () => {
  const app = ui();
  app.S.user = { id: "a", display_name: "A" };
  app.S.impact = { completed_trades: 2, completed_giveaways: 1, donations_reported: 0, compost_reported: 0 };
  const html = app.viewImpact();
  assert.match(html, /<b>2<\/b>/);
  assert.match(html, /Reported by you/);
  assert.doesNotMatch(html, /No completed handoffs/);
});

test("late response for a previous account cannot populate current impact", async () => {
  let finish;
  const app = ui(() => new Promise(resolve => { finish = resolve; }));
  app.S.user = { id: "a" };
  const pending = app.refreshImpact();
  app.S.user = { id: "b" };
  finish({ ok: true, json: async () => ({ completed_trades: 999 }) });
  await pending;
  assert.equal(app.S.impact, null);
});

test("newer impact refresh wins even if an earlier request finishes last", async () => {
  const requests = [];
  const app = ui(() => new Promise(resolve => requests.push(resolve)));
  app.S.user = { id: "a" };
  const old = app.refreshImpact(), current = app.refreshImpact();
  requests[1]({ ok: true, json: async () => ({ completed_trades: 2 }) });
  await current;
  requests[0]({ ok: true, json: async () => ({ completed_trades: 1 }) });
  await old;
  assert.equal(app.S.impact.completed_trades, 2);
});

test("Share explains Bob and never offers Opened package", () => {
  const app = ui();
  const message = "Bob is RePlate's AI helper. It drafts your listing and checks it before it goes live.";
  assert.ok(app.viewCompose().includes(message));
  assert.ok(app.viewReview().includes(message));
  assert.doesNotMatch(app.conditionOptions(""), /Opened package|value="opened"/);
});

test("allergen chips require a choice and keep old free-text declarations untouched", () => {
  const app = ui();
  assert.match(app.readDraft().miss.join(" "), /Select at least one allergen chip/);
  assert.doesNotMatch(app.viewReview(), /id="f-allergens"/);
  for (const label of allergens.ALLERGENS) assert.ok(app.viewReview().includes(`data-value="${label}"`));
  app.S.draft.allergens = "Old label: possible traces of lupin";
  assert.match(app.viewReview(), /Old label: possible traces of lupin/);
  assert.equal(app.readDraft().payload.allergens, "Old label: possible traces of lupin");
  assert.equal(app.readDraft().payload.allergen_choices, undefined);
  assert.match(app.readDraft().miss.join(" "), /Select at least one allergen chip/);
});

test("whole produce defaults to None only on condition changes; user may override", () => {
  const app = ui();
  const change = (path, value) => app.onBind({type: "change",
    target: {type: "text", value, dataset: {bind: path}}});
  change("draft.items.0.condition", "produce");
  assert.equal(app.S.draft.allergens, "None");
  app.actions["allergen-toggle"]({dataset: {value: "Milk"}});
  app.actions["allergen-toggle"]({dataset: {value: "Eggs"}});
  assert.equal(app.S.draft.allergens, "Milk, Eggs");
  change("draft.items.0.name", "apples");
  assert.equal(app.S.draft.allergens, "Milk, Eggs");
  app.actions["allergen-toggle"]({dataset: {value: "Unknown"}});
  assert.equal(app.S.draft.allergens, "Unknown");
  app.actions["allergen-toggle"]({dataset: {value: "Other"}});
  change("draft.allergen_other", "Mustard, lupin");
  assert.equal(app.S.draft.allergens, "Other: Mustard, lupin");
  assert.match(app.viewReview(), /maxlength="50"/);
  change("draft.allergen_other", "");
  assert.match(app.readDraft().miss.join(" "), /Describe the other allergen/);
  assert.equal(app.S.approval, null);
});

test("change-only Clear updates state and does not refill the cleared deadline", () => {
  const app = ui();
  app.S.draft.day = "2026-11-10";
  app.S.draft.until = "16:00";
  app.S.draft.deadline = "2026-11-10T16:00";
  const change = (path, value, type) => app.onBind({
    type: "change", target: { type, value, dataset: { bind: path } },
  });
  change("draft.deadline", "", "datetime-local");
  change("draft.until", "17:00", "time");
  assert.equal(app.S.draft.deadline, "");
  change("draft.day", "", "date");
  assert.equal(app.S.draft.day, "");
  assert.match(app.readDraft().miss.join(" "), /pickup day/);
});

test("pickup fields are free text with exact note, placeholder, limit and counter", () => {
  const app = ui();
  const html = app.spotField("test-spot", "Library steps");
  assert.match(html, /type="text"/);
  assert.match(html, /maxlength="100"/);
  assert.match(html, /13\/100/);
  assert.ok(html.includes(limits.SPOT_PLACEHOLDER));
  assert.ok(html.includes(limits.SPOT_NOTE));
  assert.doesNotMatch(html, /select|option/);
  app.S.draft.location = "Main library north entrance";
  assert.ok(app.viewReview().includes('value="Main library north entrance"'));
  assert.doesNotMatch(app.readDraft().miss.join(" "), /pickup spot/);
  app.S.draft.location = "x".repeat(101);
  assert.match(app.readDraft().miss.join(" "), /100 characters/);
});

test("Discover removes areas filter but retains free-text location cards", () => {
  const app = ui();
  app.S.loaded = true;
  app.S.listings = [{
    id: "one", mode: "giveaway", status: "open", location: "Main library front steps",
    item_details: [{ name: "onions", quantity: 3, unit: "each" }],
    deadline: new Date(Date.now() + 86400000).toISOString(),
  }];
  const html = app.viewDiscover();
  assert.doesNotMatch(html, /All areas|open-zone|set-zone/);
  assert.match(html, /Main library front steps/);
});

test("request sheet uses listing spot and Activity uses chosen request time", () => {
  const app = ui();
  const now = Date.now();
  const listing = { id: "one", name: "Owner", location: "North door by the library",
    pickup_start: new Date(now + 3600000).toISOString(),
    pickup_end: new Date(now + 4 * 3600000).toISOString(),
    deadline: new Date(now + 5 * 3600000).toISOString() };
  const form = app.giveawayBody(listing);
  assert.match(form, /North door by the library/);
  assert.match(form, /name="location" readonly/);
  assert.doesNotMatch(form, /<select id="g-zone"/);
  app.S.user = { id: "owner" };
  const row = { id: "r", owner_id: "owner", requester_id: "other", requester_name: "Hyun",
    status: "approved", location: listing.location, item_details: [],
    pickup_start: new Date(now + 2 * 3600000).toISOString(),
    pickup_end: new Date(now + 3 * 3600000).toISOString() };
  const expected = new Date(row.pickup_start).toLocaleString(undefined,
    { weekday: "short", hour: "numeric", minute: "2-digit" });
  assert.ok(app.giveawayBlock(row).includes(`Hyun will pick up ${expected}`));
  app.S.user = { id: "other" };
  assert.ok(app.giveawayBlock(row).includes(`You will pick up ${expected}`));
});
