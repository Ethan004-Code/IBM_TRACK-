import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as limits from "./limits.js";
import * as allergens from "./allergens.js";

function ui(fetchImpl = async () => { throw Error("Unexpected network request"); }) {
  const nodes = new Map();
  const listeners = new Map();
  const document = {
    body: {style: {}},
    querySelector(sel) {
      if (sel === "#review-panel") return null;
      if (!nodes.has(sel)) nodes.set(sel, {
        innerHTML: "", hidden: true, style: {}, addEventListener() {},
        classList: { toggle() {} }, contains() { return false; },
      });
      return nodes.get(sel);
    },
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
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
      spotField, viewDiscover, giveawayBody, giveawayBlock, viewActivity, listingCard, actions,
      wantedText, offerBlock, requestCard, openRequestForm };
  `, context);
  return { ...context.ui, nodes, dispatch(type, target) {
    for (const handler of listeners.get(type) || []) handler({type, target});
  }, submit(form) {
    return Promise.all((listeners.get("submit") || []).map(handler =>
      handler({target: form, preventDefault() {}})));
  } };
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

test("swaps require wanted food but no return quantity, retaining offered count limits", () => {
  const app = ui();
  assert.match(app.readDraft().miss.join(" "), /Say what food you'd like in return/);
  app.S.draft.wanted_food = "cans of beans";
  // Old drafts must not revive a hidden return-quantity requirement.
  app.S.draft.wanted_quantity = 99;
  const html = app.viewReview();
  assert.doesNotMatch(html, /want-qty|data-bind="draft.wanted_quantity"/);
  assert.match(html, /Swaps exchange the full amounts shown in both listings/);
  assert.doesNotMatch(app.readDraft().miss.join(" "), /food you'd like|return quantity/);
  assert.equal(app.readDraft().payload.wanted_quantity, null);
  assert.equal(app.readDraft().payload.wanted_food, "cans of beans");
  app.S.draft.items[0].quantity = "100";
  assert.match(app.readDraft().miss.join(" "), /99/);
  app.S.draft.items[0].quantity = "3";
  assert.equal(app.readDraft().payload.item_details[0].quantity, 3);
  assert.equal(app.wantedText({wanted_food: "rice", wanted_unit: "bag", wanted_quantity: 4}), "bags of rice");
});

test("swap acceptance shows full actual amounts for both participants", () => {
  const app = ui();
  const offer = {id: "swap", status: "pending",
    participants: [{user_id: "a", name: "Alice"}, {user_id: "b", name: "Bob"}],
    give_items: [{name: "onions", quantity: 3, unit: "each"}],
    receive_items: [{name: "cans of beans", quantity: 2, unit: "each"}],
    location: "Library", pickup_start: new Date(Date.now() + 3600000).toISOString(),
    pickup_end: new Date(Date.now() + 7200000).toISOString()};
  app.S.user = {id: "a"};
  assert.match(app.offerBlock(offer), /you give 3 onions, you get 2 cans of beans/);
  app.S.user = {id: "b"};
  assert.match(app.offerBlock(offer), /you give 2 cans of beans, you get 3 onions/);
});

test("Getting includes swaps with the same handoff controls as Sharing", () => {
  const app = ui();
  app.S.user = {id: "a"};
  app.S.activityLoaded = true;
  app.S.myOffers = [{id: "swap", status: "pending",
    participants: [{user_id: "a", name: "Alice"}, {user_id: "b", name: "Bob"}],
    give_items: [{name: "onions", quantity: 3, unit: "each"}],
    receive_items: [{name: "cans of beans", quantity: 2, unit: "each"}],
    location: "Library", pickup_start: new Date(Date.now() + 3600000).toISOString(),
    pickup_end: new Date(Date.now() + 7200000).toISOString()}];
  app.S.actSeg = "getting";
  let html = app.viewActivity();
  assert.match(html, /Your swaps/);
  assert.match(html, /you give 3 onions, you get 2 cans of beans/);
  assert.match(html, /data-action="offer-respond"/);
  assert.doesNotMatch(html, /Nothing requested yet/);
  app.S.actSeg = "sharing";
  html = app.viewActivity();
  assert.match(html, /you give 3 onions, you get 2 cans of beans/);
  assert.match(html, /data-action="offer-respond"/);
});

test("request form and cards explain optional amounts without inventing counts", () => {
  const app = ui();
  app.openRequestForm();
  const form = app.nodes.get("#sheet").innerHTML;
  assert.match(form, /Quantity \(optional\)/);
  assert.match(form, /placeholder="Any amount"/);
  assert.match(form, /don't reserve food/);
  assert.match(app.requestCard({items: ["onions"], quantity: null}), /Looking for onions · Any amount/);
  assert.match(app.requestCard({items: ["onions"], quantity: 3}), /Looking for 3 onions/);
  assert.doesNotMatch(app.requestCard({items: ["onions"], quantity: 3}), /Any amount/);
});

test("registered request submit sends null for blank, numbers for specified counts and rejects invalid input", async () => {
  const sent = [];
  const app = ui(async (url, options) => {
    sent.push(JSON.parse(options.body));
    // Controlled rejection avoids mutating any real data or mounting Activity.
    return {ok: false, status: 400, json: async () => ({error: "Fixture response"})};
  });
  const now = Date.now(), local = t => limits.toLocalInput(new Date(t));
  const form = {id: "request-form", item: {value: "onions"}, quantity: {value: ""},
    location: {value: "Library steps"}, pickup_start: {value: local(now + 3600000)},
    pickup_end: {value: local(now + 7200000)}, deadline: {value: local(now + 10800000)},
    querySelector() {return {disabled: false};}};
  await app.submit(form);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].quantity, null);
  form.quantity.value = "3";
  await app.submit(form);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].quantity, 3);
  for (const value of ["0", "100", "1.5", "-2"]) {
    form.quantity.value = value;
    await app.submit(form);
    assert.equal(sent.length, 2);
    assert.match(app.nodes.get("#rq-err").innerHTML, /99/);
  }
  form.quantity.value = "";
  form.quantity.validity = {badInput: true};
  await app.submit(form);
  assert.equal(sent.length, 2);
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

test("registered change handler synchronizes food names and times before Bob validation", () => {
  const app = ui();
  const change = (path, value, type = "text") => app.dispatch("change",
    {id: "", type, tagName: "INPUT", value, dataset: {bind: path}});
  assert.ok(app.readDraft().miss.some(m => m.includes("add a food name")));
  change("draft.items.0.name", "onions");
  assert.equal(app.S.draft.items[0].name, "onions");
  assert.ok(!app.readDraft().miss.some(m => m.includes("add a food name")));
  const day = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  change("draft.day", day, "date");
  change("draft.from", "15:00", "time");
  change("draft.until", "14:00", "time");
  assert.match(app.readDraft().miss.join(" "), /Pickup end needs to be after/);
  change("draft.until", "17:00", "time");
  assert.doesNotMatch(app.readDraft().miss.join(" "), /Pickup end needs to be after/);
  assert.equal(app.readDraft().payload.item_details[0].name, "onions");
  assert.equal(app.readDraft().payload.pickup_end, new Date(`${day}T17:00`).toISOString());
  change("draft.wanted_food", "cans of beans");
  assert.equal(app.readDraft().payload.wanted_food, "cans of beans");
  change("draft.items.0.name", "");
  assert.ok(app.readDraft().miss.some(m => m.includes("add a food name")));
});

test("duplicate input/change events do not invalidate unchanged Bob approval", () => {
  const app = ui();
  const target = {id: "", type: "text", tagName: "INPUT", value: "onions",
    dataset: {bind: "draft.items.0.name"}};
  app.dispatch("input", target);
  const approved = {id: "approved-current"};
  app.S.approval = approved;
  const gen = app.S.reviewGen;
  app.dispatch("change", target);
  assert.equal(app.S.approval, approved);
  assert.equal(app.S.reviewGen, gen);
  app.dispatch("change", {...target, value: "rice"});
  assert.equal(app.S.approval, null);
  assert.ok(app.S.reviewGen > gen);
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
