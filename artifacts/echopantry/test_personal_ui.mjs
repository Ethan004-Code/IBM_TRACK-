import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as limits from "./limits.js";

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
    ...limits, document, fetch: fetchImpl, Date, Intl, URL,
    createDonationMap() {}, setInterval() {}, setTimeout() {},
  });
  const source = fs.readFileSync(new URL("./new.js", import.meta.url), "utf8")
    .replace(/^import .*;$/gm, "").split("\ninitialize();")[0];
  vm.runInContext(source + `
    globalThis.ui = { S, viewImpact, refreshImpact, conditionOptions,
      viewCompose, viewReview, onBind, readDraft, signedOut };
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
