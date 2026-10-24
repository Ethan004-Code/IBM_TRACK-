/* RePlate: app-style frontend.
   Uses the same Flask API, fields and rules as app.js. Only the screens are new. */
import { createDonationMap } from "./new-donation-map.js";
import { foldName, parseQty, qtyError, pickupLimits, printedLimits, windowErrors, printedCheck, ITEM_PLACEHOLDER, CANON_UNIT, QTY_MIN, QTY_MAX, SPOT_MAX, SPOT_PLACEHOLDER, SPOT_NOTE, spotError } from "./limits.js";
import { parseAllergens, allergenValue, toggleAllergen, allergenError, allergenPayload, allergenMarkup } from "./allergens.js";
import "./allergens.css";
const API = "/api";
const DATE_TYPES = { best_by: "Best by", use_by: "Use by", sell_by: "Sell by", expiration: "Expiration" };
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const REVIEW_TTL_MS = 15 * 60000, REVIEW_TIMEOUT_MS = 90000, MAX_PHOTO = 5 * 1024 * 1024, MAX_ITEMS = 5;

/* ---------------- Helpers ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cap = s => { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); };
const pad = n => String(n).padStart(2, "0");

async function api(path, options = {}) {
  let res;
  try { res = await fetch(`${API}${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...options }); }
  catch (er) {
    if (er?.name === "AbortError") { const e = Error("The request timed out."); e.timeout = true; throw e; }
    throw Error("Can't reach the RePlate server. Check your connection and try again.");
  }
  let data = {}; try { data = await res.json(); } catch {}
  if (!res.ok) { const e = Error(data.error || `Something went wrong (${res.status}). Try again.`); e.status = res.status; e.data = data; throw e; }
  return data;
}
const post = (p, body = {}) => api(p, { method: "POST", body: JSON.stringify(body) });

function toUtcIso(v) { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
function toLocalInput(v) { const d = new Date(v); if (!v || Number.isNaN(d.getTime())) return ""; return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function dayPart(v) { return toLocalInput(v).slice(0, 10); }
function timePart(v) { return toLocalInput(v).slice(11, 16); }
function dayLabel(d) {
  const t = new Date(), a = new Date(t.getFullYear(), t.getMonth(), t.getDate()), b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((b - a) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function timeLabel(d) { return d.toLocaleTimeString(undefined, d.getMinutes() ? { hour: "numeric", minute: "2-digit" } : { hour: "numeric" }); }
function windowText(a, b) {
  const s = new Date(a), e = new Date(b);
  if (!a || !b || Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "No pickup time set";
  const sameDay = s.toDateString() === e.toDateString();
  return sameDay ? `${dayLabel(s)}, ${timeLabel(s)}–${timeLabel(e)}` : `${dayLabel(s)} ${timeLabel(s)} – ${dayLabel(e)} ${timeLabel(e)}`;
}
function fullDate(v) { const d = new Date(v); return !v || Number.isNaN(d.getTime()) ? "Not set" : d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }

function itemsOf(l) {
  if (Array.isArray(l?.item_details) && l.item_details.length) return l.item_details;
  if (Array.isArray(l?.items)) return l.items.map(x => typeof x === "string" ? { name: x, quantity: l.quantities?.[x] ?? null, unit: null } : x);
  return [];
}
function itemText(i) {
  if (typeof i === "string") return i;
  if (i.quantity == null || i.quantity === "") return cap(i.name);
  return `${i.quantity} ${foldName(i.name, i.unit, i.quantity)}`;
}
function itemsText(arr) { return (arr || []).map(i => itemText(i).replace(/^./, c => c.toLowerCase())).join(", ") || "items"; }
function listingTitle(l) {
  const items = itemsOf(l);
  if (items.length === 1) return cap(itemText(items[0]));
  if (items.length === 2) return `${cap(items[0].name || items[0])} & ${String(items[1].name || items[1]).toLowerCase()}`;
  if (items.length > 2) return `${cap(items[0].name || items[0])} + ${items.length - 1} more`;
  return "Food listing";
}
function wantedText(l) {
  if (l.wanted_food) return itemText({ name: l.wanted_food, quantity: l.wanted_quantity, unit: l.wanted_unit }).replace(/^./, c => c.toLowerCase());
  return (l.wants || []).join(", ");
}
function isPackaged(l) { const items = itemsOf(l); return items.length > 0 && items.every(i => i.category === "shelf_stable"); }
function photoBlock(l, cls = "") {
  const pkg = isPackaged(l) ? " pkg" : "";
  const img = l.photo_id ? `<img src="${API}/listing-photos/${encodeURIComponent(l.photo_id)}" alt="Photo of ${esc(itemsOf(l).map(i => i.name || i).join(", "))}" loading="lazy" onerror="this.remove()">` : "";
  return `<div class="ph${pkg} ${cls}" ${img ? "" : 'role="img" aria-label="No photo"'}><span class="art"><i></i><i></i><i></i></span>${img}</div>`;
}
function initial(name) { return esc(String(name || "?").trim().charAt(0).toUpperCase() || "?"); }
const uid = x => x?.user_id || x?.id || x;

const ICON = {
  discover: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  share: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  activity: '<path d="M4 6h16M4 12h9M4 18h6"/><path d="M15 17l2 2 4-4"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19l7-7"/>',
  sparkle: '<path d="M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0112 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>', chevL: '<path d="M15 6l-6 6 6 6"/>', chevD: '<path d="M6 9l6 6 6-6"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M5 12l5 5 9-10"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z" fill="currentColor"/>'
};
const icon = (n, s = 20, cls = "") => `<svg class="ic ${cls}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

/* ---------------- State ---------------- */
function emptyItem() { return { name: "", quantity: "", condition: "", printed_date: "", date_type: "" }; }
function emptyDraft() { return { items: [emptyItem()], mode: "exchange", wanted_food: "", wanted_quantity: "", location: "", day: "", from: "", until: "", deadline: "", allergens: "", fresh: false, storage_confirmed: false }; }
const S = {
  tab: "discover", user: null,
  listings: [], loaded: false, loadError: "",
  myListings: [], myOffers: [], myRequests: [], notifications: [], activityLoaded: false,
  impact: null, impactError: "", impactGen: 0,
  filter: { mode: "", hours: 0 },
  actSeg: "sharing",
  share: { step: "compose", text: "", busy: false, error: "", fromBob: false, notes: [] },
  draft: emptyDraft(), dtTouched: false, editingId: null,
  photo: null, photoBusy: false, uploadGen: 0, photoStatus: "",
  approval: null, reviewGen: 0, reviewing: false, publishing: false, reviewState: { kind: "idle" }, publishError: "",
  pendingAfterAuth: null, fallback: null
};

/* ---------------- Toast ---------------- */
let toastTimer;
function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3400); }

/* ---------------- Navigation ---------------- */
const TABS = [
  { id: "discover", label: "Discover", icon: "discover" },
  { id: "share", label: "Share", icon: "share" },
  { id: "activity", label: "Activity", icon: "activity" },
  { id: "impact", label: "Impact", icon: "leaf" }
];
function unreadCount() { return S.user ? S.notifications.filter(n => !n.read).length : 0; }
function renderNav() {
  const n = unreadCount();
  const tabs = TABS.map(t => `<a href="#${t.id}" class="tab" data-action="tab" data-tab="${t.id}"${S.tab === t.id ? ' aria-current="page"' : ""}>${icon(t.icon, 25)}<span>${t.label}</span>${t.id === "activity" && n ? `<span class="count" aria-label="${n} new">${n > 9 ? "9+" : n}</span>` : ""}</a>`).join("");
  $("#tabbar").innerHTML = tabs;
  $("#topnav").innerHTML = tabs;
  $("#topbar-actions").innerHTML = `<button type="button" class="btn btn-primary" data-action="go-share">${icon("plus", 17)}Share food</button>` +
    (S.user ? `<button type="button" class="avatar-btn" data-action="open-account" aria-label="Account: ${esc(S.user.display_name)}">${initial(S.user.display_name)}</button>` : `<button type="button" class="text-btn" data-action="open-signin">Sign in</button>`);
  const fab = $("#fab"); fab.hidden = S.tab !== "discover"; fab.innerHTML = `${icon("plus", 20)}Share food`;
}
function accountBtn() {
  return S.user ? `<button type="button" class="avatar-btn" data-action="open-account" aria-label="Account: ${esc(S.user.display_name)}">${initial(S.user.display_name)}</button>`
    : `<button type="button" class="text-btn signin" data-action="open-signin">Sign in</button>`;
}
function render() {
  const main = $("#main");
  main.classList.toggle("wide", S.tab === "discover");
  const html = S.tab === "discover" ? viewDiscover() : S.tab === "share" ? viewShare() : S.tab === "activity" ? viewActivity() : viewImpact();
  $("#view").innerHTML = `<div class="view">${html}</div>`;
  if (S.tab === "share") { renderPhotoSlot(); if (S.share.step === "review") renderReviewPanel(); }
}
function renderAll() { renderNav(); render(); }
function goTab(t, opts = {}) {
  if (sheetOpen()) closeSheet();
  S.tab = t; renderAll();
  if (!opts.keepScroll) window.scrollTo(0, 0);
  if (t === "impact") refreshImpact();
  if (t === "activity" && S.user) refreshActivity();
  try { history.replaceState(null, "", `#${t}`); } catch {}
}
function userIsTyping() { const a = document.activeElement; return a && $("#view").contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); }

/* ---------------- Discover ---------------- */
const HOURS = [{ v: 0, l: "Any time" }, { v: 24, l: "Next 24 hours" }, { v: 72, l: "Next 3 days" }, { v: 168, l: "This week" }];
function visibleListings() {
  const { mode, hours } = S.filter, cutoff = hours ? Date.now() + hours * 3600000 : Infinity;
  return S.listings.filter(x => x.status === "open" && (!mode || x.mode === mode) && new Date(x.deadline).getTime() <= cutoff)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
}
function listingCard(l) {
  const give = l.mode === "giveaway", soon = l.deadline && new Date(l.deadline) - Date.now() < 864e5;
  const wanted = wantedText(l);
  return `<button type="button" class="lcard" data-action="open-listing" data-id="${esc(l.id)}">${photoBlock(l)}
    <span class="lcard-body"><span class="lcard-title">${esc(listingTitle(l))}</span>
    <span class="lcard-meta">${esc(l.name || "Community member")} · ${esc(l.location)}</span>
    <span class="lcard-meta">${esc(windowText(l.pickup_start, l.pickup_end))}</span>
    <span class="badges">${give ? '<span class="badge b-free">Free</span>' : `<span class="badge b-swap">${icon("swap", 13)}${wanted ? "Swap for " + esc(wanted) : "Swap"}</span>`}${soon ? '<span class="badge b-warn">Ends soon</span>' : ""}${S.user && S.user.id === l.user_id ? '<span class="badge b-plain">Yours</span>' : ""}</span></span></button>`;
}
function viewDiscover() {
  const f = S.filter, list = visibleListings();
  let body;
  if (!S.loaded && !S.loadError) body = `<div class="cards grid"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>`;
  else if (S.loadError && !S.listings.length) body = `<div class="empty"><div class="empty-icon">${icon("alert", 26)}</div><h2>Couldn't load food nearby</h2><p>${esc(S.loadError)}</p><button type="button" class="btn btn-secondary btn-sm" data-action="reload">Try again</button></div>`;
  else if (!list.length) body = S.listings.some(x => x.status === "open")
    ? `<div class="empty"><div class="empty-icon">${icon("leaf", 26)}</div><h2>Nothing matches these filters</h2><p>Try another food type or time.</p><button type="button" class="btn btn-secondary btn-sm" data-action="clear-filters">Show everything</button></div>`
    : `<div class="empty"><div class="empty-icon">${icon("leaf", 26)}</div><h2>Nothing listed nearby yet</h2><p>Be the first to share something. It takes about a minute.</p><button type="button" class="btn btn-primary btn-sm" data-action="go-share">Share food</button></div>`;
  else body = `<div class="cards grid">${list.map(listingCard).join("")}</div>`;
  const hoursLabel = HOURS.find(h => h.v === f.hours)?.l || "Any time";
  return `<div class="promo"><div class="grow"><p class="title">Got extra groceries?</p><p class="sub">Snap a photo, describe it in a sentence, and Bob drafts the listing for you to check.</p></div>
      <button type="button" class="btn" data-action="go-share">${icon("camera", 18)}Post with a photo</button></div>
    <header class="vh discover-head"><div class="vh-row mobile-only"><a class="brand-inline" href="#discover" data-action="tab" data-tab="discover"><span class="brand-mark" aria-hidden="true">R</span><span>Re<strong>Plate</strong></span></a>${accountBtn()}</div>
      <div><h1 class="large-title">Food near you</h1><p class="vh-sub">Groceries your neighbors are passing along</p></div>
      <div class="discover-filters">
        <div class="seg" role="group" aria-label="Show">${[["", "All"], ["exchange", "Swaps"], ["giveaway", "Free"]].map(([v, l]) => `<button type="button" data-action="filter-mode" data-value="${v}" aria-pressed="${f.mode === v}">${l}</button>`).join("")}</div>
        <div class="pill-row">
        <button type="button" class="pill" data-action="open-hours">${icon("clock", 16)}<span>${esc(hoursLabel)}</span>${icon("chevD", 12)}</button>
        <button type="button" class="pill pill-donate" data-action="open-donation-locations">${icon("pin", 16)}<span>Donation locations</span></button></div>
      </div></header>
    ${body}`;
}

/* ---------------- Share: compose + review ---------------- */
function viewShare() { return S.share.step === "review" ? viewReview() : viewCompose(); }
function viewCompose() {
  const sh = S.share;
  return `<header class="vh"><div class="vh-row"><span class="eyebrow">Share food</span>${accountBtn()}</div>
      <h1 class="large-title sm">What do you have to share?</h1>
      <p class="vh-sub">Bob is RePlate's AI helper. It drafts your listing and checks it before it goes live.</p>
      <p class="vh-sub">Add a photo and describe it. Bob drafts the listing for you to check before anything goes live.</p></header>
    ${!S.user ? `<div class="note">${icon("shield", 22)}<p>You'll need to <button type="button" class="link" data-action="open-signin" style="min-height:0">sign in</button> to upload a photo and publish.</p></div>` : ""}
    <div class="step-label"><span class="step-num">1</span>Add a photo of the food</div>
    <div id="photo-slot"></div>
    <div class="step-label"><span class="step-num">2</span><label for="share-text">Describe it in your own words</label></div>
    <div class="composer"><textarea id="share-text" rows="3" maxlength="1200" data-bind="share.text" placeholder="I have five onions and one unopened bag of rice. I can meet at the library Friday from 3 to 5.">${esc(sh.text)}</textarea></div>
    ${sh.error ? `<div class="alert" role="alert">${icon("alert", 20)}<p>${esc(sh.error)}</p></div>` : ""}
    <button type="button" class="btn btn-primary btn-block" data-action="interpret"${sh.busy ? " disabled" : ""}>${sh.busy ? '<span class="spin" aria-hidden="true"></span>Bob is reading your description…' : `${icon("sparkle", 19)}Fill in with Bob`}</button>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <button type="button" class="link" data-action="manual">Fill in the form myself</button>
      <button type="button" class="link" data-action="open-rules">${icon("shield", 16)}What can I share?</button>
    </div>`;
}
function photoSlotHtml(compact) {
  const p = S.photo;
  if (!p) return compact
    ? `<div class="photo-card"><div class="ph" role="img" aria-label="No photo yet"><span class="art"><i></i><i></i><i></i></span></div><div class="grow"><span class="name">No photo yet</span><span class="state bad">A photo is required to publish</span></div><button type="button" class="btn btn-primary btn-sm" data-action="pick-photo">${icon("camera", 17)}Add</button></div>${S.photoStatus ? `<p class="foot" style="margin:0 4px">${esc(S.photoStatus)}</p>` : ""}`
    : `<button type="button" class="photo-drop" data-action="pick-photo"><span class="circle">${icon("camera", 24)}</span><b>Take or choose a photo</b><small>Required · JPG, PNG or WebP, up to 5 MB</small></button>${S.photoStatus ? `<p class="foot" style="margin:0 4px">${esc(S.photoStatus)}</p>` : ""}`;
  const src = p.local_url || p.preview_url || (p.id ? `${API}/listing-photos/${encodeURIComponent(p.id)}` : "");
  let state;
  if (S.photoBusy) state = `<span class="state"><span class="spin" aria-hidden="true" style="width:13px;height:13px;border-width:2px"></span>Uploading…</span>`;
  else if (p.id) state = `<span class="state ok">${icon("check", 14)}Photo uploaded</span>`;
  else state = `<span class="state bad">${S.user ? "Not uploaded yet" : "Sign in to upload"}</span>`;
  return `<div class="photo-card"><div class="ph"><span class="art"><i></i><i></i><i></i></span>${src ? `<img src="${esc(src)}" alt="Your food photo">` : ""}</div>
    <div class="grow"><span class="name">${esc(p.filename || "Saved listing photo")}</span>${state}</div>
    <div class="photo-actions">${!p.id && p.file && !S.photoBusy ? `<button type="button" class="btn btn-primary btn-sm" data-action="retry-photo">${S.user ? "Retry" : "Sign in"}</button>` : ""}
    <button type="button" class="btn btn-secondary btn-sm" data-action="pick-photo">Replace</button></div></div>
    ${S.photoStatus ? `<p class="foot" style="margin:0 4px">${esc(S.photoStatus)}</p>` : ""}
    ${p ? `<button type="button" class="link danger" data-action="remove-photo" style="align-self:flex-start;min-height:36px;font-size:14px">Remove photo</button>` : ""}`;
}
function renderPhotoSlot() { const el = $("#photo-slot"); if (el) el.innerHTML = photoSlotHtml(S.share.step === "review"); }

function conditionOptions(sel) {
  return [["", "Choose"], ["produce", "Whole produce"], ["shelf_stable", "Unopened package"]]
    .map(([v, l]) => `<option value="${v}"${v === sel ? " selected" : ""}>${l}</option>`).join("");
}
const QTY_ATTRS = `type="number" min="${QTY_MIN}" max="${QTY_MAX}" step="1" inputmode="numeric" pattern="[0-9]*"`;
function spotField(id, value = "", attrs = "") {
  return `<div class="pickup-field"><div class="row"><label for="${id}">Pickup spot</label><input id="${id}" type="text" maxlength="${SPOT_MAX}" placeholder="${SPOT_PLACEHOLDER}" value="${esc(value)}" aria-describedby="${id}-note ${id}-count" data-spot-counter="${id}-count" ${attrs}></div><div class="pickup-help"><span id="${id}-note">${SPOT_NOTE}</span><span id="${id}-count" role="status">${String(value).length}/${SPOT_MAX}</span></div></div>`;
}
function viewReview() {
  const d = S.draft, sh = S.share, pl = printedLimits(), lim = pickupLimits();
  const items = d.items.map((it, i) => `<div class="item-ed">
      <div class="item-top"><label class="sr-only" for="it-${i}-name">Food ${i + 1}</label><input id="it-${i}-name" data-bind="draft.items.${i}.name" value="${esc(it.name)}" placeholder="${ITEM_PLACEHOLDER}" autocomplete="off">
      ${d.items.length > 1 ? `<button type="button" class="icon-btn" data-action="remove-item" data-idx="${i}" aria-label="Remove ${esc(it.name || "item " + (i + 1))}">${icon("trash", 19)}</button>` : ""}</div>
      <div class="item-grid">
        <label class="mini" for="it-${i}-qty"><span>Quantity</span><input id="it-${i}-qty" ${QTY_ATTRS} data-bind="draft.items.${i}.quantity" value="${esc(it.quantity)}"></label>
        <label class="mini" for="it-${i}-cond"><span>Condition</span><select id="it-${i}-cond" data-bind="draft.items.${i}.condition" data-rerender="1">${conditionOptions(it.condition)}</select></label>
      </div>
      ${it.condition === "opened" ? `<p class="field-error">Opened packages can't be shared. Remove this item or change it.</p>` : ""}
      <details class="more-dates"${it.printed_date || it.date_type ? " open" : ""}><summary>Printed date (optional)</summary>
        <div class="item-grid" style="margin-top:6px">
          <label class="mini" for="it-${i}-date"><span>Date</span><input id="it-${i}-date" type="date" min="${pl.min}" max="${pl.max}" data-bind="draft.items.${i}.printed_date" value="${esc(it.printed_date)}"></label>
          <label class="mini" for="it-${i}-dtype"><span>Label</span><select id="it-${i}-dtype" data-bind="draft.items.${i}.date_type"><option value="">None</option>${Object.entries(DATE_TYPES).map(([k, v]) => `<option value="${k}"${k === it.date_type ? " selected" : ""}>${v}</option>`).join("")}</select></label>
        </div></details>
    </div>`).join("");
  const add = d.items.length < MAX_ITEMS ? `<button type="button" class="row row-btn row-add" data-action="add-item">${icon("plus", 18)}<span class="grow">Add another item (up to 5)</span></button>` : "";
  const how = d.mode === "exchange"
    ? `<div class="group"><div class="item-ed"><div class="item-top"><label class="sr-only" for="want-name">Food you'd like in return</label><input id="want-name" data-bind="draft.wanted_food" value="${esc(d.wanted_food)}" placeholder="${ITEM_PLACEHOLDER}" autocomplete="off"></div>
        <div class="item-grid"><label class="mini" for="want-qty"><span>Quantity</span><input id="want-qty" ${QTY_ATTRS} data-bind="draft.wanted_quantity" value="${esc(d.wanted_quantity)}"></label></div></div></div>`
    : `<p class="foot" style="margin:0 4px">Neighbors can ask for it and you choose who gets it. Nothing is promised until you approve.</p>`;
  return `<header class="vh"><div class="vh-row"><button type="button" class="back-btn" data-action="back-compose">${icon("chevL", 22)}Back</button>${accountBtn()}</div>
      <h1 class="large-title sm">${S.editingId ? "Edit your listing" : "Check your listing"}</h1><p class="vh-sub">Bob is RePlate's AI helper. It drafts your listing and checks it before it goes live.</p><p class="vh-sub">Nothing goes live until Bob checks it and you publish.</p></header>
    ${S.editingId ? `<div class="edit-banner"><span>You're editing a saved listing. It stays unchanged until you publish.</span><button type="button" class="link" data-action="cancel-edit">Cancel</button></div>` : ""}
    ${sh.fromBob ? `<span class="bob-tag">${icon("sparkle", 15)}Drafted by Bob · check each detail</span>` : ""}
    ${sh.notes.length ? `<div class="check-note"><p>Please check</p><ul>${sh.notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>` : ""}
    <p class="section-label">Photo</p>
    <div id="photo-slot"></div>
    <p class="section-label">What you're sharing</p>
    <div class="group">${items}${add}</div>
    <p class="section-label">How do you want to share?</p>
    <div class="seg" role="group" aria-label="Share mode"><button type="button" data-action="set-mode" data-value="exchange" aria-pressed="${d.mode === "exchange"}">Swap</button><button type="button" data-action="set-mode" data-value="giveaway" aria-pressed="${d.mode === "giveaway"}">Give away</button></div>
    ${how}
    <p class="section-label">When and where</p>
    <div class="group">
      ${spotField("f-zone", d.location, 'data-bind="draft.location"')}
      <div class="row"><label for="f-day">Day</label><input id="f-day" type="date" min="${lim.minDay}" max="${lim.maxDay}" data-bind="draft.day" value="${esc(d.day)}"></div>
      <div class="row"><label for="f-from">From</label><input id="f-from" type="time" min="${d.day === lim.minDay ? lim.minInput.slice(11) : "00:00"}" max="${d.day === lim.maxDay ? lim.maxInput.slice(11) : "23:59"}" data-bind="draft.from" value="${esc(d.from)}"></div>
      <div class="row"><label for="f-until">Until</label><input id="f-until" type="time" min="${d.day === lim.minDay ? lim.minInput.slice(11) : "00:00"}" max="${d.day === lim.maxDay ? lim.maxInput.slice(11) : "23:59"}" data-bind="draft.until" value="${esc(d.until)}"></div>
      <div class="row"><label for="f-deadline">Available until</label><input id="f-deadline" type="datetime-local" min="${lim.minInput}" max="${lim.maxInput}" data-bind="draft.deadline" value="${esc(d.deadline)}"></div>
    </div>
    <p class="foot">Meet at a public spot. Never share your home address. Pickup must be within the next year, and "Available until" can't be earlier than your pickup end.</p>
    <p class="section-label">Allergens</p>
    <div class="group">${allergenMarkup(d.allergens, esc, 'data-bind="draft.allergen_other"', "f-allergen")}</div>
    <p class="foot">Choose "Unknown" if you're not sure. Your selection is shown to whoever picks up.</p>
    <label class="check" for="f-fresh"><input id="f-fresh" type="checkbox" data-bind="draft.fresh"${d.fresh ? " checked" : ""}>These are whole produce in good condition or unopened shelf-stable food.</label>
    <label class="check" for="f-storage"><input id="f-storage" type="checkbox" data-bind="draft.storage_confirmed"${d.storage_confirmed ? " checked" : ""}>I stored them properly and listed known allergens above.</label>
    <div class="review-panel" id="review-panel"></div>
    <div id="publish-slot"></div>
    ${S.editingId ? `<button type="button" class="btn btn-plain btn-block" data-action="cancel-edit">Cancel editing</button>` : ""}`;
}

/* Draft → API payload (same shape and checks as app.js) */
function readDraft() {
  const miss = [], warn = [], d = S.draft, mode = d.mode, now = Date.now();
  const items = d.items.map(it => {
    const category = it.condition === "produce" ? "produce" : (it.condition === "shelf_stable" || it.condition === "opened") ? "shelf_stable" : null;
    const unopened = it.condition === "shelf_stable" ? true : it.condition === "opened" ? false : null;
    return { name: String(it.name).trim(), quantity: parseQty(it.quantity), unit: CANON_UNIT, category, unopened, printed_date: it.printed_date || null, date_type: it.date_type || null };
  });
  const type = items.length > 1 ? "bundle" : "single";
  if (items.length < 1 || items.length > MAX_ITEMS) miss.push("List between 1 and 5 items.");
  items.forEach((it, i) => {
    const n = items.length > 1 ? `Item ${i + 1}${it.name ? ` (${it.name})` : ""}: ` : "";
    if (!it.name) miss.push(`${n}add a food name.`);
    const qe = qtyError(d.items[i].quantity); if (qe) miss.push(n ? `${n}${qe.replace(/^./, c => c.toLowerCase())}` : qe);
    if (!["produce", "shelf_stable"].includes(it.category)) miss.push(`${n}choose its condition.`);
    if (it.category === "shelf_stable" && it.unopened !== true) miss.push(`${n}packaged food must be unopened.`);
    if (!!it.printed_date !== !!it.date_type) miss.push(`${n}set both the printed date and its label, or neither.`);
    const pc = printedCheck(it.printed_date, it.date_type, now);
    pc.errors.forEach(e => miss.push(`${n}${e}`)); pc.warnings.forEach(w => warn.push(`${n}${w}`));
  });
  const wf = String(d.wanted_food).trim(), wq = parseQty(d.wanted_quantity);
  if (mode === "exchange") { if (!wf) miss.push("Say what food you'd like in return."); const qe = qtyError(d.wanted_quantity, "amount for the food you'd like"); if (qe) miss.push(qe); }
  const locationError = spotError(d.location); if (locationError) miss.push(locationError);
  const ps = d.day && d.from ? toUtcIso(`${d.day}T${d.from}`) : null, pe = d.day && d.until ? toUtcIso(`${d.day}T${d.until}`) : null, dl = toUtcIso(d.deadline);
  if (!d.day) { miss.push("Pick a pickup day."); if (!dl) miss.push('Set "Available until".'); }
  else windowErrors({ start: ps, end: pe, deadline: dl, needDeadline: true }, now).forEach(e => miss.push(e));
  const allergens = String(d.allergens).trim(), allergenMessage = allergenError(d.allergens);
  if (allergenMessage) miss.push(allergenMessage);
  if (!d.fresh) miss.push("Confirm the food's condition.");
  if (!d.storage_confirmed) miss.push("Confirm storage and allergens.");
  if (S.photoBusy) miss.push("Wait for the photo to finish uploading."); else if (!S.photo?.id) miss.push(S.photo ? "Upload your photo (tap Retry)." : "Add a photo of the actual food.");
  const payload = { mode, listing_type: type, item_details: items, wanted_food: mode === "exchange" ? wf : null, wanted_quantity: mode === "exchange" ? wq : null, wanted_unit: mode === "exchange" ? CANON_UNIT : null, location: d.location, pickup_start: ps, pickup_end: pe, deadline: dl, timezone: TZ, fresh: !!d.fresh, storage_confirmed: !!d.storage_confirmed, allergens, ...allergenPayload(d.allergens), photo_id: S.photo?.id || null };
  return { payload, key: JSON.stringify(payload), miss, warn };
}
function approvalValid(d) { return !!(S.approval && S.user && S.approval.key === d.key && Date.now() < S.approval.exp && S.approval.photo_id === S.photo?.id); }
function invalidateApproval(changed) {
  const had = S.approval || S.reviewing;
  S.approval = null; S.reviewGen++; S.reviewing = false;
  S.reviewState = { kind: "idle", message: had && changed ? "You changed something, so Bob needs to check again." : "" };
  renderReviewPanel();
}
function renderReviewPanel() {
  const el = $("#review-panel"); if (!el) return;
  const d = readDraft();
  if (S.approval && Date.now() >= S.approval.exp) { S.approval = null; S.reviewState = { kind: "error", message: "Bob's approval expired. Check again before publishing." }; }
  const ok = approvalValid(d), r = S.reviewState;
  const checklist = d.miss.length
    ? `<div class="checklist"><p>Before Bob can check (${d.miss.length} to go)</p><ul>${d.miss.map(m => `<li>${esc(m)}</li>`).join("")}</ul></div>`
    : `<div class="checklist"><p class="ok">${icon("check", 18)}All required details are complete</p></div>`;
  let status = d.warn.length ? `<div class="check-note"><p>Heads up</p><ul>${d.warn.map(w => `<li>${esc(w)}</li>`).join("")}</ul></div>` : "";
  if (S.reviewing) status += `<div class="rs-checking"><span class="spin" aria-hidden="true"></span><span>Bob is checking your details and photo. Any edit cancels this check.</span></div>`;
  else if (ok) { const mins = Math.max(0, Math.ceil((S.approval.exp - Date.now()) / 60000)); status += `<div class="rs-approved"><strong>Bob approved this listing.</strong> ${esc(S.approval.reason || "The photo matches your details.")} Publish by ${esc(new Date(S.approval.exp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }))} (about ${mins} min).</div>`; }
  else if (r.kind === "rejected" || r.kind === "error") {
    const checks = Array.isArray(r.checks) ? r.checks : r.checks && typeof r.checks === "object" ? Object.entries(r.checks).map(([k, v]) => `${k.replaceAll("_", " ")}: ${typeof v === "object" ? (v.message || v.reason || (v.passed ? "ok" : "needs attention")) : v}`) : [];
    status += `<div class="rs-${r.kind}"><strong>${r.kind === "rejected" ? "Bob didn't approve this yet." : "The check couldn't finish."}</strong> ${esc(r.message || "")}${checks.length ? `<ul>${checks.map(c => `<li>${esc(typeof c === "string" ? c : c.message || c.reason || c.name || JSON.stringify(c))}</li>`).join("")}</ul>` : ""} Your entries are kept. Fix them and check again.</div>`;
  } else if (r.message) status += `<div class="rs-checking">${esc(r.message)}</div>`;
  const canCheck = S.user && !d.miss.length && !S.reviewing && !S.publishing;
  el.innerHTML = `${checklist}${status}
    <button type="button" class="btn btn-outline btn-block" data-action="review"${canCheck ? "" : " disabled"}>${S.reviewing ? '<span class="spin" aria-hidden="true"></span>Bob is checking…' : `${icon("sparkle", 18)}${ok ? "Check again with Bob" : "Check with Bob"}`}</button>
    ${!S.user ? `<p class="foot" style="margin:0"><button type="button" class="link" data-action="open-signin" style="min-height:0">Sign in</button> to check and publish.</p>` : ""}
    <p class="foot" style="margin:0">Bob can make mistakes, and a check isn't a food safety guarantee. Any edit needs a new check.</p>`;
  const canPublish = S.user && !d.miss.length && ok && !S.reviewing && !S.publishing;
  $("#publish-slot").innerHTML = `${S.publishError ? `<div class="alert" role="alert" style="margin-bottom:10px">${icon("alert", 20)}<p>${esc(S.publishError)}</p></div>` : ""}
    <button type="button" class="btn btn-primary btn-block" data-action="publish"${canPublish ? "" : " disabled"}>${S.publishing ? '<span class="spin" aria-hidden="true"></span>Publishing…' : S.editingId ? "Publish changes" : "Publish listing"}</button>`;
}
setInterval(() => { if (S.approval || S.reviewing) renderReviewPanel(); }, 1000);

function fromApiItem(i) {
  const condition = i.category === "produce" ? "produce" : i.category === "shelf_stable" ? (i.unopened === true ? "shelf_stable" : i.unopened === false ? "opened" : "") : "";
  return { name: foldName(i.name || "", i.unit, i.quantity), quantity: i.quantity ?? "", condition, printed_date: /^\d{4}-\d{2}-\d{2}$/.test(i.printed_date || "") ? i.printed_date : "", date_type: DATE_TYPES[i.date_type] ? i.date_type : "" };
}
async function doInterpret() {
  const text = String(S.share.text || "").trim();
  if (!text) { S.share.error = "Describe your food first, like “5 onions and a bag of rice, library Friday 3 to 5.”"; render(); return; }
  if (!S.user) { requireAuth(doInterpret); return; }
  S.share.busy = true; S.share.error = ""; render();
  try {
    const { draft } = await post("/interpret-listing", { text, timezone: TZ });
    const d = emptyDraft();
    const items = (draft.item_details || []).slice(0, MAX_ITEMS);
    d.items = items.length ? items.map(fromApiItem) : [emptyItem()];
    if (d.items.every(it => it.condition === "produce")) d.allergens = "None";
    d.location = draft.location || "";
    const notes = [...(draft.ambiguities || [])];
    if (draft.location) notes.push(`Check the pickup spot "${draft.location}". Use a public place, not your home address.`);
    if (draft.availability) notes.push(`You said you're free "${draft.availability}". Set the exact day and times below.`);
    if (draft.deadline_text) notes.push(`You said "${draft.deadline_text}". Set "Available until" to the exact date and time.`);
    S.draft = d; S.dtTouched = false; S.share.fromBob = true; S.share.notes = notes; S.share.step = "review"; S.publishError = "";
    S.share.busy = false; render(); window.scrollTo(0, 0); invalidateApproval(false);
  } catch (e) {
    S.share.busy = false; S.share.error = `Bob couldn't read that: ${e.message} Your text is kept. Try again, or fill in the form yourself.`; render();
  }
}
async function doReview() {
  if (!S.user) return openSignIn();
  const d = readDraft(); if (d.miss.length) return renderReviewPanel();
  const gen = ++S.reviewGen; S.approval = null; S.reviewing = true; S.reviewState = { kind: "checking" }; renderReviewPanel();
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), REVIEW_TIMEOUT_MS);
  try {
    const r = await api("/listings/review", { method: "POST", body: d.key, signal: ctrl.signal });
    if (gen !== S.reviewGen || !S.user || readDraft().key !== d.key) return;
    if (r.approved === true && r.approval_id && r.photo_id === d.payload.photo_id) {
      const server = Date.parse(r.expires_at);
      S.approval = { id: r.approval_id, key: d.key, photo_id: r.photo_id, reason: r.reason || "", exp: Math.min(Number.isFinite(server) ? server : Infinity, Date.now() + REVIEW_TTL_MS) };
      S.reviewState = { kind: "approved" };
    } else S.reviewState = { kind: "rejected", message: r.reason || r.error || "Bob didn't approve this listing.", checks: r.checks };
  } catch (er) {
    if (gen !== S.reviewGen) return;
    if (er.status === 422) S.reviewState = { kind: "rejected", message: er.data?.reason || er.message, checks: er.data?.checks };
    else if (er.status === 401) S.reviewState = { kind: "error", message: "Your session ended. Sign in again." };
    else S.reviewState = { kind: "error", message: er.timeout ? "Bob didn't respond in time. Try again shortly." : er.status === 503 ? `${er.message} Bob is unavailable, so publishing is paused for now.` : er.message };
  } finally { clearTimeout(t); if (gen === S.reviewGen) { S.reviewing = false; renderReviewPanel(); } }
}
async function doPublish() {
  if (!S.user) return openSignIn();
  const d = readDraft();
  if (d.miss.length || !approvalValid(d) || S.reviewing || S.publishing) { S.publishError = d.miss.length ? "Finish the missing details first." : "Check the current details with Bob before publishing."; return renderReviewPanel(); }
  const body = JSON.stringify({ ...d.payload, approval_id: S.approval.id }), id = S.editingId, mode = d.payload.mode;
  S.publishing = true; S.publishError = ""; renderReviewPanel();
  try {
    const r = id ? await api(`/listings/${encodeURIComponent(id)}`, { method: "PATCH", body }) : await post("/listings", JSON.parse(body));
    const n = (r.matches || []).length, lid = r.listing?.id || id;
    S.photo = null; resetEditor(false);
    S.share = { step: "compose", text: "", busy: false, error: "", fromBob: false, notes: [] };
    toast(id ? "Changes published." : mode === "giveaway" ? "Giveaway published. Neighbors can ask for it now." : n ? `Published. ${n} possible swap${n === 1 ? "" : "s"} found.` : "Published. We'll look for a swap.");
    S.actSeg = "sharing"; goTab("activity"); await load();
    if (mode === "exchange" && lid && n) openFallback(lid);
  } catch (er) {
    S.approval = null; S.reviewState = { kind: "error", message: "That approval can't be used anymore. Check again with Bob." };
    S.publishError = `${er.message} Your entries are kept.`; if (er.status === 409) load();
  } finally { S.publishing = false; renderReviewPanel(); }
}
function resetEditor(discard = true) {
  S.uploadGen++; if (discard) discardPhoto(S.photo); else if (S.photo?.local_url) URL.revokeObjectURL(S.photo.local_url);
  S.photo = null; S.photoBusy = false; S.photoStatus = ""; S.editingId = null; S.draft = emptyDraft(); S.dtTouched = false; S.publishError = "";
  S.approval = null; S.reviewGen++; S.reviewing = false; S.reviewState = { kind: "idle" };
}
function editListing(l, over = {}) {
  if (!S.user) return openSignIn();
  S.uploadGen++; discardPhoto(S.photo);
  const d = emptyDraft();
  const items = itemsOf(l).slice(0, MAX_ITEMS).map(i => typeof i === "string" ? fromApiItem({ name: i }) : fromApiItem(i));
  d.items = items.length ? items : [emptyItem()];
  d.mode = over.mode || l.mode || "exchange";
  d.wanted_food = l.wanted_food ? foldName(l.wanted_food, l.wanted_unit, l.wanted_quantity) : ""; d.wanted_quantity = l.wanted_quantity ?? "";
  d.location = l.location || "";
  d.day = dayPart(l.pickup_start); d.from = timePart(l.pickup_start); d.until = timePart(l.pickup_end); d.deadline = toLocalInput(l.deadline);
  d.allergens = l.allergens || "";
  S.draft = d; S.dtTouched = true; S.editingId = l.id; S.publishError = "";
  S.photo = l.photo_id ? { id: l.photo_id, owned: false } : null; S.photoBusy = false;
  S.photoStatus = S.photo ? "Using the saved photo. Replace it if the food has changed." : "This listing has no photo yet. Add one to publish.";
  S.share = { step: "review", text: "", busy: false, error: "", fromBob: false, notes: over.mode === "giveaway" ? ["You're switching this listing to a giveaway. Reconfirm the condition and storage, check with Bob, then publish."] : ["Reconfirm the condition and storage, check with Bob, then publish your changes."] };
  goTab("share"); invalidateApproval(false);
}

/* Photo upload (same endpoint and rules as app.js) */
function discardPhoto(p) { if (p?.local_url) URL.revokeObjectURL(p.local_url); if (p?.owned && p.id) api(`/listing-photos/${encodeURIComponent(p.id)}`, { method: "DELETE" }).catch(() => {}); }
function photoChanged() { renderPhotoSlot(); invalidateApproval(true); }
$("#photo-input").addEventListener("change", e => {
  const file = e.target.files[0]; e.target.value = ""; if (!file) return;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { S.photoStatus = "Use a JPG, PNG or WebP image."; return photoChanged(); }
  if (file.size > MAX_PHOTO) { S.photoStatus = "That photo is larger than 5 MB. Choose a smaller one."; return photoChanged(); }
  const old = S.photo; S.photo = { id: null, local_url: URL.createObjectURL(file), file, filename: file.name, owned: false, guestDraft: !S.user }; discardPhoto(old);
  if (!S.user) { S.photoStatus = "Photo saved on this device. Sign in to upload it."; return photoChanged(); }
  photoChanged(); uploadSelectedPhoto();
});
async function uploadSelectedPhoto() {
  if (!S.photo?.file) return;
  if (!S.user) return openSignIn();
  const file = S.photo.file, gen = ++S.uploadGen;
  S.photoBusy = true; S.photoStatus = ""; photoChanged();
  const fd = new FormData(); fd.append("photo", file);
  try {
    const res = await fetch(`${API}/listing-photos`, { method: "POST", credentials: "include", body: fd }).catch(() => { throw Error("Can't reach the RePlate server."); });
    let data = {}; try { data = await res.json(); } catch {}
    if (!res.ok) throw Error(data.error || `Upload failed (${res.status}).`);
    if (!data.photo_id || !data.preview_url) throw Error("The upload didn't return a saved photo. Please retry.");
    const fresh = { id: data.photo_id, preview_url: data.preview_url, filename: file.name, owned: true };
    if (gen !== S.uploadGen || !S.user) { discardPhoto(fresh); return; }
    const old = S.photo; S.photo = fresh; discardPhoto(old); S.photoStatus = "";
  } catch (er) { if (gen === S.uploadGen) S.photoStatus = `${er.message} Your photo is still selected. Tap Retry when ready.`; }
  finally { if (gen === S.uploadGen) { S.photoBusy = false; photoChanged(); } }
}

/* ---------------- Activity ---------------- */
function offerSides(o) {
  const me = S.user?.id, parts = o.participants || [];
  const iAmFirst = parts[0] ? uid(parts[0]) === me : true;
  const other = parts.find(p => uid(p) !== me);
  return { give: iAmFirst ? (o.give_items || o.give) : (o.receive_items || o.receive), get: iAmFirst ? (o.receive_items || o.receive) : (o.give_items || o.give), otherName: other?.name || "Your swap partner", otherId: uid(other) };
}
function offerBlock(o) {
  const me = S.user.id, acc = (o.accepted_by || []).map(uid), done = (o.completed_by || []).map(uid), s = o.status, iAcc = acc.includes(me), iDone = done.includes(me);
  const { give, get, otherName } = offerSides(o);
  let actions = "", note = "";
  if ((s === "pending" || s === "awaiting_second_acceptance") && !iAcc) { note = `${acc.length ? `${esc(otherName)} accepted. ` : ""}You both need to accept.`; actions = `<div class="btn-row"><button type="button" class="btn btn-secondary btn-sm" data-action="offer-respond" data-id="${esc(o.id)}" data-accept="0">Decline</button><button type="button" class="btn btn-primary btn-sm" data-action="offer-respond" data-id="${esc(o.id)}" data-accept="1">Accept</button></div>`; }
  else if ((s === "pending" || s === "awaiting_second_acceptance") && iAcc) { note = `You accepted. Waiting for ${esc(otherName)}.`; actions = `<button type="button" class="link danger" data-action="offer-cancel" data-id="${esc(o.id)}" style="align-self:flex-start">Cancel offer</button>`; }
  if ((s === "confirmed" || s === "completion_pending") && !iDone) { actions = `<p class="info">You're meeting ${esc(otherName)} at ${esc(o.location)}, ${esc(windowText(o.pickup_start, o.pickup_end))}.</p><button type="button" class="btn btn-outline btn-sm btn-block" data-action="offer-pickup" data-id="${esc(o.id)}">I completed the handoff</button>${s === "confirmed" && !done.length ? `<button type="button" class="link danger" data-action="offer-cancel" data-id="${esc(o.id)}" style="align-self:flex-start">Cancel</button>` : ""}`; }
  else if (s === "completion_pending" && iDone) note = `You confirmed the handoff. Waiting for ${esc(otherName)}.`;
  if (s === "completed") actions = `<div class="subtle-row"><span>Swap completed. Thanks!</span><button type="button" class="btn btn-secondary btn-sm" data-action="rate-offer" data-id="${esc(o.id)}">Rate ${esc(otherName)}</button></div>`;
  if (s === "declined" || s === "cancelled") note = `This swap was ${s}.`;
  return `<div class="handoff"><div class="who"><div class="face" aria-hidden="true">${initial(otherName)}</div><div><p><b>Swap with ${esc(otherName)}:</b> you give ${esc(itemsText(give))}, you get ${esc(itemsText(get))}.</p><p class="meta">${esc(o.location)} · ${esc(windowText(o.pickup_start, o.pickup_end))}</p></div></div>
    ${note ? `<p class="foot" style="margin:0">${note}</p>` : ""}${actions}</div>`;
}
function giveawayBlock(r) {
  const me = S.user.id, owner = r.owner_id === me, done = (r.completed_by || r.confirmed_by || []).map(uid), iDone = done.includes(me), s = r.status;
  const otherName = owner ? (r.requester_name || "A neighbor") : (S.listings.find(l => l.id === r.listing_id)?.name || "The owner");
  let actions = "", note = "";
  if (s === "pending" && owner) actions = `<div class="btn-row"><button type="button" class="btn btn-secondary btn-sm" data-action="gr-decide" data-id="${esc(r.id)}" data-accept="0">Decline</button><button type="button" class="btn btn-primary btn-sm" data-action="gr-decide" data-id="${esc(r.id)}" data-accept="1">Approve</button></div>`;
  if (s === "pending" && !owner) { note = "Waiting for the owner to approve."; actions = `<button type="button" class="link danger" data-action="gr-cancel" data-id="${esc(r.id)}" style="align-self:flex-start">Cancel request</button>`; }
  if ((s === "approved" || s === "completion_pending") && !iDone) actions = `<p class="info">Pickup at ${esc(r.location)}, ${esc(windowText(r.pickup_start, r.pickup_end))}.</p><button type="button" class="btn btn-outline btn-sm btn-block" data-action="gr-pickup" data-id="${esc(r.id)}">I completed the handoff</button>${s === "approved" && !done.length ? `<button type="button" class="link danger" data-action="gr-cancel" data-id="${esc(r.id)}" style="align-self:flex-start">Cancel</button>` : ""}`;
  else if (s === "completion_pending" && iDone) note = `You confirmed the handoff. Waiting for ${esc(otherName)}.`;
  if (s === "completed") actions = `<div class="subtle-row"><span>Giveaway completed. Thanks!</span><button type="button" class="btn btn-secondary btn-sm" data-action="rate-gr" data-id="${esc(r.id)}" data-to="${esc(owner ? r.requester_id : r.owner_id)}">Rate ${owner ? "recipient" : "giver"}</button></div>`;
  if (s === "declined" || s === "cancelled") note = `This request was ${s}.`;
  const at = r.pickup_start ? new Date(r.pickup_start).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }) : "the requested time";
  const pickupLine = `${owner ? otherName : "You"} ${s === "completed" ? "picked up" : "will pick up"} ${at}`;
  const line = owner ? `<b>${esc(otherName)}</b> asked for this giveaway` : `You asked for <b>${esc(itemsText(r.item_details))}</b>`;
  return `<div class="handoff"><div class="who"><div class="face" aria-hidden="true">${initial(otherName)}</div><div><p>${line}</p><p class="meta">${esc(pickupLine)}</p><p class="meta">${esc(r.location)} · ${esc(windowText(r.pickup_start, r.pickup_end))}</p></div></div>${note ? `<p class="foot" style="margin:0">${note}</p>` : ""}${actions}</div>`;
}
const ACTIVE_OFFER = ["pending", "awaiting_second_acceptance", "confirmed", "completion_pending"];
const ACTIVE_GR = ["pending", "approved", "completion_pending"];
function handoffsFor(l) {
  const offers = S.myOffers.filter(o => o.listing_id === l.id || o.match_id === l.id);
  const grs = S.myRequests.filter(r => r.listing_id === l.id && r.owner_id === S.user.id);
  return { offers, grs };
}
function listingStage(l, h) {
  const all = [...h.offers.map(o => o.status), ...h.grs.map(r => r.status)];
  if (l.status === "completed" || all.includes("completed")) return { n: 4, badge: '<span class="badge b-ok">Done</span>' };
  if (all.some(s => ["confirmed", "completion_pending", "approved"].includes(s)) || l.status === "reserved") return { n: 3, badge: '<span class="badge b-ok">Pickup set</span>' };
  if (all.some(s => ["pending", "awaiting_second_acceptance"].includes(s))) return { n: 2, badge: '<span class="badge b-warn">New offer</span>' };
  const map = { open: '<span class="badge b-muted">Listed</span>', expired: '<span class="badge b-muted">Ended</span>', withdrawn: '<span class="badge b-muted">Withdrawn</span>' };
  return { n: 1, badge: map[l.status] || `<span class="badge b-muted">${esc(cap(String(l.status || "").replaceAll("_", " ")))}</span>` };
}
function myListingCard(l) {
  const h = handoffsFor(l), st = listingStage(l, h);
  const shown = [...h.offers.filter(o => ACTIVE_OFFER.includes(o.status) || o.status === "completed").map(offerBlock), ...h.grs.filter(r => ACTIVE_GR.includes(r.status) || r.status === "completed").map(giveawayBlock)];
  const mode = l.mode === "giveaway" ? "Free" : `Swap${wantedText(l) ? " for " + wantedText(l) : ""}`;
  const noActive = !h.offers.some(o => ACTIVE_OFFER.includes(o.status)) && !h.grs.some(r => ACTIVE_GR.includes(r.status));
  const nextRow = ["open", "expired", "withdrawn"].includes(l.status) && noActive
    ? `<div class="subtle-row"><span>${l.status === "open" ? "No active offers yet" : l.status === "expired" ? "This listing has ended" : "Withdrawn"}</span><button type="button" class="link" data-action="open-fallback" data-id="${esc(l.id)}" style="padding:0 10px">See next steps${icon("chevR", 15)}</button></div>` : "";
  const textActions = [
    ["open", "expired"].includes(l.status) ? `<button type="button" class="link" data-action="edit-listing" data-id="${esc(l.id)}">Edit</button>` : "",
    l.status === "open" && !noActive ? `<button type="button" class="link" data-action="open-fallback" data-id="${esc(l.id)}">Other options</button>` : "",
    l.status === "open" ? `<button type="button" class="link danger" data-action="withdraw" data-id="${esc(l.id)}">Withdraw</button>` : ""
  ].join("");
  return `<section class="acard" aria-label="${esc(listingTitle(l))}"><div class="acard-head">${photoBlock(l)}<div class="grow"><h3>${esc(listingTitle(l))}</h3><p>${esc(mode)} · ${esc(l.location)} · ${esc(windowText(l.pickup_start, l.pickup_end))}</p></div>${st.badge}</div>
    <ol class="steps" aria-label="Progress">${["Listed", "Offer", "Pickup", "Done"].map((s, i) => `<li class="${i < st.n ? "on" : ""}">${s}</li>`).join("")}</ol>
    ${shown.join("")}${nextRow}${textActions ? `<div class="text-actions">${textActions}</div>` : ""}</section>`;
}
function requestCard(r) {
  const name = (r.items || []).join(", ") || r.item || "";
  return `<section class="acard"><div class="acard-head"><div class="grow"><h3>Looking for ${esc(itemText({ name, quantity: r.quantity, unit: r.unit }).replace(/^./, c => c.toLowerCase()))}</h3><p>${esc(r.location)} · ${esc(windowText(r.pickup_start, r.pickup_end))}</p><p>Needed by ${esc(fullDate(r.deadline))}</p></div><span class="badge ${r.status === "open" || !r.status ? "b-muted" : "b-ok"}">${esc(cap(String(r.status || "open").replaceAll("_", " ")))}</span></div></section>`;
}
function viewActivity() {
  const head = `<header class="vh"><div class="vh-row"><span></span>${accountBtn()}</div><h1 class="large-title">Activity</h1></header>`;
  if (!S.user) return head + `<div class="empty"><div class="empty-icon">${icon("activity", 26)}</div><h2>Your listings and pickups live here</h2><p>Sign in to see offers, confirm handoffs and track what you've shared.</p><button type="button" class="btn btn-primary btn-sm" data-action="open-signin">Sign in</button></div>`;
  if (!S.activityLoaded) return head + `<div class="skel" style="height:190px"></div><div class="skel" style="height:140px"></div>`;
  const myIds = new Set(S.myListings.map(l => l.id));
  const orphanOffers = S.myOffers.filter(o => !myIds.has(o.listing_id) && !myIds.has(o.match_id) && (ACTIVE_OFFER.includes(o.status) || o.status === "completed"));
  const giveaways = S.myRequests.filter(r => r.requester_id || (r.listing_id && r.owner_id));
  const asked = giveaways.filter(r => r.owner_id !== S.user.id);
  const standalone = S.myRequests.filter(r => !giveaways.includes(r));
  const ups = S.notifications.slice(0, 3);
  const updates = ups.length ? `<p class="section-label">Updates${unreadCount() ? ` · ${unreadCount()} new` : ""}</p><div class="updates">${ups.map(n => `<div class="update"><span class="dot${n.read ? " read" : ""}" aria-hidden="true"></span><div><small>${esc(String(n.kind || "update").replaceAll("_", " "))}</small>${esc(n.message)}${n.location ? `<p class="meta">${esc(n.location)}${n.pickup_start ? ` · ${esc(windowText(n.pickup_start, n.pickup_end))}` : ""}</p>` : ""}</div></div>`).join("")}</div>` : "";
  const seg = `<div class="seg" role="group" aria-label="Show"><button type="button" data-action="act-seg" data-value="sharing" aria-pressed="${S.actSeg === "sharing"}">Sharing</button><button type="button" data-action="act-seg" data-value="getting" aria-pressed="${S.actSeg === "getting"}">Getting</button></div>`;
  let body;
  if (S.actSeg === "sharing") {
    body = S.myListings.length || orphanOffers.length
      ? S.myListings.map(myListingCard).join("") + (orphanOffers.length ? `<p class="section-label">Other swaps</p><section class="acard">${orphanOffers.map(offerBlock).join("")}</section>` : "")
      : `<div class="empty"><div class="empty-icon">${icon("share", 26)}</div><h3>You haven't shared anything yet</h3><p>Got extra groceries? Add a photo and Bob drafts the listing.</p><button type="button" class="btn btn-primary btn-sm" data-action="go-share">Share food</button></div>`;
  } else {
    const a = asked.map(r => `<section class="acard">${giveawayBlock(r).replace('<div class="handoff">', '<div class="handoff" style="border-top:0;padding-top:0">')}</section>`).join("");
    const reqs = standalone.map(requestCard).join("");
    body = `${a ? `<p class="section-label">Food you asked for</p>${a}` : ""}${reqs ? `<p class="section-label">Your requests</p>${reqs}` : ""}
      ${!a && !reqs ? `<div class="empty"><div class="empty-icon">${icon("discover", 26)}</div><h3>Nothing requested yet</h3><p>Ask for a giveaway you see nearby, or post a request for something specific.</p></div>` : ""}
      <button type="button" class="btn btn-secondary btn-block" data-action="open-request">${icon("plus", 18)}Post a request for food</button>`;
  }
  return head + updates + seg + body;
}

/* ---------------- Impact ---------------- */
function viewImpact() {
  const head = `<header class="vh"><div class="vh-row"><span class="eyebrow">Your activity</span>${accountBtn()}</div><h1 class="large-title">Your impact</h1><p class="vh-sub">Food you've shared or picked up through completed handoffs.</p></header>`;
  if (!S.user) return head + `<div class="empty"><div class="empty-icon">${icon("leaf", 26)}</div><h2>Sign in to see your impact</h2><button type="button" class="btn btn-primary btn-sm" data-action="open-signin">Sign in</button></div>`;
  const how = `<p class="section-label">What counts</p><div class="group" style="padding:14px 16px"><ul class="how">
    <li>${icon("check", 20)}<span>A swap or giveaway counts once both people confirm the handoff.</span></li>
    <li>${icon("check", 20)}<span>Only donations and compost drop-offs you report are counted here.</span></li>
    <li>${icon("check", 20)}<span>Suggestions and scheduled pickups don't count until they happen.</span></li></ul></div>`;
  if (!S.impact && !S.impactError) return head + `<div class="stats"><div class="skel"></div><div class="skel"></div></div>`;
  if (!S.impact) return head + `<div class="empty"><div class="empty-icon">${icon("alert", 26)}</div><h2>Impact isn't available right now</h2><p>${esc(S.impactError)}</p><button type="button" class="btn btn-secondary btn-sm" data-action="reload-impact">Try again</button></div>` + how;
  const d = S.impact, q = d.quantities || [];
  const food = q.filter(x => x.action !== "compost"), comp = q.filter(x => x.action === "compost");
  const total = (d.completed_trades || 0) + (d.completed_giveaways || 0) + (d.donations_reported || 0) + (d.compost_reported || 0);
  const row = x => `<div class="qty-row"><span>${esc(itemText(x))}</span>${x.action === "donation" ? "<span>Donated</span>" : ""}</div>`;
  return head + (total ? "" : `<div class="info">No completed handoffs yet. Share or pick up food to get started.</div>`) +
    `<div class="stats">
      <div class="stat lead"><b>${esc(d.completed_trades ?? 0)}</b><span>Swaps completed</span></div>
      <div class="stat"><b>${esc(d.completed_giveaways ?? 0)}</b><span>Giveaways completed</span></div>
      <div class="stat"><b>${esc(d.donations_reported ?? 0)}</b><span>Donations</span><small>Reported by you</small></div>
      <div class="stat"><b>${esc(d.compost_reported ?? 0)}</b><span>Compost drop-offs</span><small>Reported by you</small></div></div>
    ${food.length ? `<p class="section-label">Food passed on</p><div class="group">${food.map(row).join("")}</div>` : ""}
    ${comp.length ? `<p class="section-label">Composted (reported by members)</p><div class="group">${comp.map(row).join("")}</div>` : ""}
    ${d.note ? `<p class="foot" style="margin:0 4px">${esc(d.note)}</p>` : ""}` + how;
}

/* ---------------- Sheets ---------------- */
let lastFocus = null;
function openSheet(title, body, sub = "") {
  destroyDMap();
  routeSeq++; fbSeq++; S.fallback = null;
  lastFocus = document.activeElement;
  $("#sheet").innerHTML = `<div class="grab" aria-hidden="true"></div><div class="sheet-head"><div><h2 id="sheet-title">${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}</div><button type="button" class="close-btn" data-action="close-sheet" aria-label="Close">${icon("close", 15)}</button></div><div class="sheet-body" id="sheet-body">${body}</div>`;
  $("#sheet-root").hidden = false; document.body.style.overflow = "hidden";
  setTimeout(() => { const f = $("#sheet").querySelector("input:not([type=checkbox]),textarea,select") || $("#sheet .close-btn"); f?.focus({ preventScroll: true }); }, 40);
}
function setSheetBody(html) { const b = $("#sheet-body"); if (b) b.innerHTML = html; }
function closeSheet() { destroyDMap(); routeSeq++; fbSeq++; $("#sheet-root").hidden = true; document.body.style.overflow = ""; S.fallback = null; if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true }); }
function sheetOpen() { return !$("#sheet-root").hidden; }
function sheetError(msg) { return msg ? `<div class="alert" role="alert">${icon("alert", 20)}<p>${esc(msg)}</p></div>` : ""; }

let confirmFn = null;
function openConfirm({ title, text, confirm = "Confirm", danger = false, onConfirm }) {
  confirmFn = onConfirm;
  openSheet(title, `<p style="margin:0;font-size:15.5px;line-height:1.45">${esc(text)}</p><div class="btn-row"><button type="button" class="btn btn-secondary btn-sm" data-action="close-sheet">Not now</button><button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"} btn-sm" data-action="confirm-yes">${esc(confirm)}</button></div>`);
}

function requireAuth(next) { if (S.user) return next(); S.pendingAfterAuth = next; openSignIn("login", "Sign in to continue"); }
function authBody(mode, err = "", busy = false, ok = "") {
  const s = mode === "signup";
  return `<div class="seg" role="group" aria-label="Account"><button type="button" data-action="auth-mode" data-value="login" aria-pressed="${!s}">Sign in</button><button type="button" data-action="auth-mode" data-value="signup" aria-pressed="${s}">Create account</button></div>
    <form id="auth-form" data-mode="${mode}" class="sheet-body" novalidate><div class="group">
      ${s ? `<div class="row"><label for="a-name">Name</label><input id="a-name" name="display_name" autocomplete="name" maxlength="60" placeholder="First name"></div>` : ""}
      <div class="row"><label for="a-email">Email</label><input id="a-email" name="email" type="email" autocomplete="email" placeholder="you@example.com"></div>
      <div class="row"><label for="a-pass">Password</label><input id="a-pass" name="password" type="password" autocomplete="${s ? "new-password" : "current-password"}" placeholder="${s ? "At least 8 characters" : "Required"}"></div>
    </div>${sheetError(err)}${ok ? `<p class="info">${esc(ok)}</p>` : ""}
    <button type="submit" class="btn btn-primary btn-block"${busy ? " disabled" : ""}>${busy ? '<span class="spin" aria-hidden="true"></span>' : ""}${s ? "Create account" : "Sign in"}</button>
    <p class="foot" style="margin:0;text-align:center">Passwords are handled by Supabase Auth and never stored in RePlate profiles.</p></form>`;
}
function openSignIn(mode = "login", title) { openSheet(title || (mode === "signup" ? "Join RePlate" : "Welcome back"), authBody(mode)); }
function openAccount() {
  openSheet("Your account", `<dl class="kv"><dt>Name</dt><dd>${esc(S.user.display_name)}</dd>${S.user.email ? `<dt>Email</dt><dd>${esc(S.user.email)}</dd>` : ""}</dl>
    <button type="button" class="btn btn-secondary btn-block" data-action="sign-out">Sign out</button>
    <button type="button" class="link danger" data-action="delete-account" style="align-self:center">Delete account</button>`);
}
function openHours() {
  openSheet("Ending within", `<div class="group">${HOURS.map(h => `<button type="button" class="row row-btn" data-action="set-hours" data-value="${h.v}" aria-pressed="${S.filter.hours === h.v}"><span class="grow">${h.l}</span>${S.filter.hours === h.v ? `<span style="color:var(--forest)">${icon("check", 20)}</span>` : ""}</button>`).join("")}</div>`);
}
function openRules() {
  openSheet("What you can share", `<div class="group" style="padding:14px 16px"><ul class="how">
      <li>${icon("check", 20)}<span>Whole fruit and vegetables in good condition</span></li>
      <li>${icon("check", 20)}<span>Unopened shelf-stable packaged food, like pasta, rice and canned goods</span></li></ul></div>
    <p class="section-label">Not allowed</p><div class="group" style="padding:14px 16px"><ul class="how">
      <li>${icon("close", 20)}<span>Homemade or cooked food</span></li><li>${icon("close", 20)}<span>Opened packages</span></li><li>${icon("close", 20)}<span>Dairy or raw meat</span></li></ul></div>
    <p class="foot" style="margin:0 4px">Every listing needs a photo of the actual food, and Bob checks it before it goes live. Never post a home address.</p>`);
}
function findListing(id) { return S.listings.find(x => x.id === id) || S.myListings.find(x => x.id === id); }
function openListing(id) {
  const l = findListing(id); if (!l) return;
  const owner = S.user && S.user.id === l.user_id, give = l.mode === "giveaway", items = itemsOf(l);
  const rows = items.map(i => `<div class="row"><span style="flex:1">${esc(cap(itemText(i)))}${i.printed_date ? `<br><small class="muted">${esc(DATE_TYPES[i.date_type] || "Date")}: ${esc(i.printed_date)}</small>` : ""}</span>${i.category ? `<span class="badge ${i.category === "produce" ? "b-free" : "b-pkg"}">${i.category === "produce" ? "Whole produce" : "Unopened"}</span>` : ""}</div>`).join("");
  let actions;
  if (owner) actions = `<div class="btn-row"><button type="button" class="btn btn-secondary btn-sm" data-action="edit-listing" data-id="${esc(l.id)}">Edit</button><button type="button" class="btn btn-primary btn-sm" data-action="open-fallback" data-id="${esc(l.id)}">Next steps</button></div>`;
  else actions = `<button type="button" class="btn btn-primary btn-block" data-action="${give ? "ask-giveaway" : "offer-swap"}" data-id="${esc(l.id)}">${give ? "Ask for it" : "Offer a swap"}</button>`;
  openSheet(listingTitle(l), `${photoBlock(l, "hero-photo")}
    <div class="badges">${give ? '<span class="badge b-free">Free</span>' : `<span class="badge b-swap">${icon("swap", 13)}Swap</span>`}${l.rating ? `<span class="badge b-plain">${icon("star", 13)}${Number(l.rating).toFixed(1)}</span>` : ""}</div>
    <div class="group">${rows}</div>
    ${!give && wantedText(l) ? `<div class="note">${icon("swap", 22)}<p><b>${esc(l.name || "The owner")}</b> would like <b>${esc(wantedText(l))}</b> in return.</p></div>` : ""}
    <dl class="kv"><dt>Where</dt><dd>${esc(l.location)}</dd><dt>Pickup</dt><dd>${esc(windowText(l.pickup_start, l.pickup_end))}</dd><dt>Until</dt><dd>${esc(fullDate(l.deadline))}</dd><dt>Allergens</dt><dd>${esc(l.allergens || "Not listed")}</dd><dt>Shared by</dt><dd>${esc(l.name || "Community member")}</dd></dl>
    ${actions}
    ${!owner ? `<div class="text-actions" style="justify-content:center"><button type="button" class="link" data-action="report-user" data-id="${esc(l.user_id)}" style="color:var(--muted)">Report</button><button type="button" class="link" data-action="block-user" data-id="${esc(l.user_id)}" style="color:var(--muted)">Block user</button></div>` : ""}`);
}
function giveawayBounds(l) {
  const lim = pickupLimits(), lo = Math.max(lim.min, new Date(l.pickup_start).getTime() || lim.min);
  const hi = Math.min(lim.max, ...[l.pickup_end, l.deadline].map(v => new Date(v).getTime()).filter(Number.isFinite));
  return { min: toLocalInput(Math.ceil(lo / 60000) * 60000), max: toLocalInput(hi) };
}
function giveawayBody(l, err = "", busy = false, vals = {}) {
  const gb = giveawayBounds(l);
  return `<p style="margin:0;font-size:15px;line-height:1.45">${esc(l.name || "The owner")} is free <b>${esc(windowText(l.pickup_start, l.pickup_end))}</b> at <b>${esc(l.location)}</b>. Pick a time inside that window.</p>
    <form id="giveaway-form" data-id="${esc(l.id)}" class="sheet-body" novalidate><div class="group">
      ${spotField("g-zone", l.location || "", 'name="location" readonly')}
      <div class="row"><label for="g-from">From</label><input id="g-from" name="pickup_start" type="datetime-local" min="${gb.min}" max="${gb.max}" value="${esc(vals.pickup_start ?? gb.min)}"></div>
      <div class="row"><label for="g-until">Until</label><input id="g-until" name="pickup_end" type="datetime-local" min="${gb.min}" max="${gb.max}" value="${esc(vals.pickup_end ?? gb.max)}"></div>
    </div>${sheetError(err)}
    <button type="submit" class="btn btn-primary btn-block"${busy ? " disabled" : ""}>${busy ? '<span class="spin" aria-hidden="true"></span>Sending…' : "Send request"}</button>
    <p class="foot" style="margin:0">The owner decides who gets it.</p></form>`;
}
function openRequestForm() {
  const lim = pickupLimits(), rng = `min="${lim.minInput}" max="${lim.maxInput}"`;
  openSheet("Post a food request", `<p class="foot" style="margin:0 4px">One food, with an amount and the times you can pick up. We'll notify you when someone nearby lists it.</p>
    <form id="request-form" class="sheet-body" novalidate><div class="group">
      <div class="row"><label for="rq-item">Food</label><input id="rq-item" name="item" placeholder="${ITEM_PLACEHOLDER}" autocomplete="off"></div>
      <div class="row"><label for="rq-qty">Quantity</label><input id="rq-qty" name="quantity" ${QTY_ATTRS} placeholder="1"></div></div>
    <div class="group">
      ${spotField("rq-zone", "", 'name="location"')}
      <div class="row"><label for="rq-from">Pickup from</label><input id="rq-from" name="pickup_start" type="datetime-local" ${rng}></div>
      <div class="row"><label for="rq-until">Pickup until</label><input id="rq-until" name="pickup_end" type="datetime-local" ${rng}></div>
      <div class="row"><label for="rq-deadline">Needed by</label><input id="rq-deadline" name="deadline" type="datetime-local" ${rng}></div></div>
    <div id="rq-err"></div><button type="submit" class="btn btn-primary btn-block">Post request</button></form>`);
}
function openRate(body, who) {
  S.rating = { body, stars: 0 };
  openSheet(`Rate ${who}`, rateBody());
}
function rateBody() {
  const s = S.rating.stars;
  return `<p style="margin:0;font-size:15px;text-align:center" class="muted">How did the handoff go?</p>
    <div class="stars" role="group" aria-label="Stars">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="star" data-action="set-star" data-value="${n}" aria-pressed="${n <= s}" aria-label="${n} star${n > 1 ? "s" : ""}">${icon("star", 28)}</button>`).join("")}</div>
    <button type="button" class="btn btn-primary btn-block" data-action="save-rating"${s ? "" : " disabled"}>Save rating</button>`;
}

/* Public donation directory (no listing, no sign-in) */
async function openDonationLocations() {
  openSheet("Donation locations", `<div class="skel" style="height:90px"></div><div class="skel dn-map"></div><div class="skel" style="height:150px"></div>`, "San Jose and Silicon Valley food donation spots");
  const tok = ++fbSeq;
  try {
    const res = await api("/donation-locations");
    if (tok !== fbSeq || !sheetOpen()) return;
    const options = (res.options || []).filter(o => o && o.id != null && o.type !== "compost");
    S.fallback = { browse: true, id: null, fb: { options, routing_configured: res.routing_configured, message: res.message || "" }, err: {}, sel: null, routingDown: !res.routing_configured, route: { area: "", max: 30, status: "idle", rows: [], origin: null, error: "", seq: 0 } };
    renderFallback();
  } catch (e) { if (tok !== fbSeq || !sheetOpen()) return; setSheetBody(`${sheetError(e.message)}<button type="button" class="btn btn-secondary btn-block" data-action="open-donation-locations">Try again</button>`); }
}
function browseBody() {
  const { fb } = S.fallback, opts = fb.options || [];
  let html = `<div class="dn-notice"><p><strong>Covers San Jose and Silicon Valley only.</strong> This is a researched directory of food donation organizations, not a check of any specific item.</p><p>Always confirm current acceptance rules and hours on the official link before you go.</p></div>`;
  if (fb.message) html += `<p class="foot" style="margin:0 4px">${esc(fb.message)}</p>`;
  if (!opts.length) return html + `<div class="empty"><div class="empty-icon">${icon("pin", 26)}</div><h3>No donation locations listed yet</h3><p>The directory is empty right now. Check back later.</p><button type="button" class="btn btn-secondary btn-sm" data-action="open-donation-locations">Refresh</button></div>`;
  return html + `<section class="dn-area" aria-labelledby="dn-title"><h3 id="dn-title" class="sr-only">Donation locations by drive time</h3>${routeFormHtml()}<div id="dn-results" class="dn-results">${routeResultsHtml()}</div></section>`;
}

/* Next steps for a listing (fallback options) */
async function openFallback(id) {
  const l = findListing(id);
  openSheet("Next steps", `<div class="skel" style="height:120px"></div><div class="skel" style="height:160px"></div>`, l ? `${listingTitle(l)} · nothing changes until you choose` : "");
  const tok = ++fbSeq;
  try {
    const fb = await api(`/listings/${encodeURIComponent(id)}/fallback-options`);
    if (tok !== fbSeq || !sheetOpen() || !S.user) return;
    S.fallback = { id, fb, err: {}, sel: null, routingDown: !fb.routing_configured, route: { area: "", max: 30, status: "idle", rows: [], origin: null, error: "", seq: 0 } };
    renderFallback();
  }
  catch (e) { if (tok !== fbSeq || !sheetOpen()) return; setSheetBody(`${sheetError(e.message)}<button type="button" class="btn btn-secondary btn-block" data-action="open-fallback" data-id="${esc(id)}">Try again</button>`); }
}
function fallbackBody() {
  if (S.fallback.browse) return browseBody();
  const { id, fb, err } = S.fallback, matches = fb.matches || [], opts = fb.options || [];
  const donations = opts.filter(o => o.type === "donation"), compost = opts.filter(o => o.type === "compost");
  const inedible = fb.inedible_confirmed === true || S.myListings.some(l => l.id === id && l.inedible_confirmed === true);
  let html = fb.message ? `<p class="foot" style="margin:0 4px">${esc(fb.message)}</p>` : "";
  html += `<p class="section-label">Another match</p>` + (matches.length ? matches.map((m, i) => `<div class="dest">
      <p style="margin:0;font-size:15px;line-height:1.45">You give <b>${esc(itemsText(m.give_items || m.give))}</b>. You get <b>${esc(itemsText(m.receive_items || m.receive))}</b>.</p>
      <p class="foot" style="margin:0">${m.listing?.name ? esc(m.listing.name) + " · " : ""}${esc(m.location || m.listing?.location || "")} · ${esc(windowText(m.pickup_start, m.pickup_end))}</p>
      ${m.reason ? `<p class="foot" style="margin:0">${esc(m.reason)}</p>` : ""}
      <button type="button" class="btn btn-primary btn-sm" data-action="propose" data-idx="${i}">Propose this swap</button></div>`).join("") : `<p class="foot" style="margin:0 4px">No compatible swap right now. New listings are checked as they come in.</p>`);
  if (fb.can_switch_to_giveaway) html += `<p class="section-label">Give it away instead</p><div class="dest" style="flex-direction:row;align-items:center;gap:12px"><p style="margin:0;flex:1;font-size:14.5px;line-height:1.4">More neighbors can ask for it. You'll review it and Bob checks the change first.</p><button type="button" class="btn btn-outline btn-sm" data-action="fb-giveaway" style="flex:none">Make it free</button></div>`;
  html += `<p class="section-label">Donation</p><p class="foot" style="margin:0 4px">A researched list, not live acceptance. Confirm the current rules before you go. Nothing is donated automatically.</p>`;
  if (donations.length) html += `<section class="dn-area" aria-labelledby="dn-title"><h3 id="dn-title" class="sr-only">Verified donation spots by drive time</h3>${routeFormHtml()}<div id="dn-results" class="dn-results">${routeResultsHtml()}</div></section>`;
  else html += `<p class="foot" style="margin:0 4px">${inedible
    ? "Donation is unavailable because this listing is marked as no longer edible."
    : "No verified donation destination is compatible with these items. Current verified partners accept only eligible unopened, unexpired, shelf-stable food without glass."}</p>`;
  html += `<p class="section-label">Compost</p>`;
  html += compost.length ? compost.map(o => destCard(o, inedible, err)).join("") : `<p class="foot" style="margin:0 4px">${inedible
    ? "No verified compost destination is compatible with these items. The current compost option accepts only fruit and vegetable scraps."
    : "Compost is available only after you confirm the food is no longer edible. A missed exchange or pickup deadline does not mean food is spoiled."}</p>`;
  if (!inedible) html += `<details class="more"><summary>Is this food no longer edible?${icon("chevD", 16)}</summary>
      <label class="check" for="inedible-check"><input type="checkbox" id="inedible-check"><span>This food is no longer edible. I understand this removes it from offers. A missed pickup alone doesn't mean food is spoiled.</span></label>
      ${err.inedible ? sheetError(err.inedible) : ""}<button type="button" class="btn btn-danger btn-sm" data-action="confirm-inedible" style="margin-top:10px">Confirm it's not edible</button></details>`;
  return html;
}

/* ---------------- Donation drive-time search + map ---------------- */
let dMap = null, routeSeq = 0, fbSeq = 0;
const hasPt = o => o && Number.isFinite(o.latitude) && Number.isFinite(o.longitude);
function destroyDMap() { if (dMap) dMap.destroy(); dMap = null; }
function destCard(o, inedible, err, pin = 0) {
  const browse = !!S.fallback?.browse, compostLocked = o.type === "compost" && !inedible, donation = o.type !== "compost";
  const routed = Number.isFinite(o.drive_minutes);
  const where = o.address || o.location;
  return `<div class="dest${donation ? " dest-pickable" : ""}${donation && S.fallback?.sel === String(o.id) ? " selected" : ""}"${donation ? ` data-dest-card="${esc(o.id)}" tabindex="0" aria-label="${esc(o.name)}${routed ? `, ${esc(o.drive_minutes)} minutes by car` : ""}. Press Enter to show on map."` : ""}>
      <div class="dest-top">${pin ? `<span class="dest-pin" aria-hidden="true">${pin}</span>` : ""}<h4>${esc(o.name)}</h4>${routed ? `<div class="dn-route"><strong>${esc(o.drive_minutes)} min</strong><span>${esc(o.drive_miles)} mi by car</span></div>` : ""}</div>
      <div class="badges"><span class="badge ${o.type === "compost" ? "b-pkg" : "b-ok"}">${o.type === "compost" ? "Compost" : "Donation"}</span>${donation && !browse && o.item_rules_status ? `<span class="badge b-soft">${o.item_rules_status === "matched" ? "Verified item match" : "Confirm your item"}</span>` : ""}</div>
      <dl><dt>Where</dt><dd>${esc(where)}</dd><dt>Hours</dt><dd>${esc(String(o.hours || "Not published").replace(/^Published:\s*/i, ""))}</dd><dt>Accepts</dt><dd>${esc((o.accepted_categories || []).map(c => String(c).replaceAll("_", " ")).join(", ") || "See website")}</dd>${o.exclusions?.length ? `<dt>Not</dt><dd>${esc(o.exclusions.join(", "))}</dd>` : ""}${o.checked_at ? `<dt>Checked</dt><dd>${esc(o.checked_at)}</dd>` : ""}</dl>
      ${o.policy ? `<p class="foot" style="margin:0">${esc(o.policy)}</p>` : ""}
      ${o.notice ? `<p class="foot" style="margin:0">${esc(o.notice)}</p>` : ""}
      ${o.url ? `<a class="link" href="${esc(o.url)}" target="_blank" rel="noopener">${browse ? "Official donation instructions" : "Confirm current rules"} ${icon("ext", 14)}</a>` : ""}
      ${browse ? "" : compostLocked ? `<p class="foot" style="margin:0">Compost is only for food that's no longer edible. Confirm that below first.</p>` : `
      <label class="check" for="fz-${esc(o.id)}"><input type="checkbox" id="fz-${esc(o.id)}" data-feasible="${esc(o.id)}"><span>${o.type === "compost" ? "These are accepted fruit and vegetable scraps, and I confirmed I can get there during its published hours." : "These are unopened packages with no glass, and I confirmed I can get there during its published hours."}</span></label>
      <label class="check" for="dp-${esc(o.id)}"><input type="checkbox" id="dp-${esc(o.id)}" data-drop="${esc(o.id)}"><span>I actually dropped this food off here.</span></label>
      ${err[o.id] ? sheetError(err[o.id]) : ""}
      <button type="button" class="btn btn-secondary btn-sm" data-action="record-outcome" data-id="${esc(o.id)}" data-type="${esc(o.type)}">Record ${o.type === "compost" ? "compost" : "donation"} drop-off</button>`}</div>`;
}
function routeFormHtml() {
  const { route: r, routingDown } = S.fallback;
  return `<form id="route-form" class="route-form" novalidate>
    <label class="mini route-area" for="route-area"><span>City or ZIP code</span><input id="route-area" name="area" type="text" maxlength="100" autocomplete="postal-code" placeholder="e.g. 95125 or Campbell" value="${esc(r.area)}"></label>
    <label class="mini route-max" for="route-max"><span>Max drive</span><select id="route-max" name="max_drive_minutes">${[15, 30, 60].map(m => `<option value="${m}"${r.max === m ? " selected" : ""}>${m} min</option>`).join("")}</select></label>
    <button type="submit" class="btn btn-primary btn-sm" id="route-go"${routingDown || r.status === "loading" ? " disabled" : ""}>${r.status === "loading" ? "Searching" : "Find drive times"}</button>
  </form><p class="foot route-privacy">We only use the area you type. Your exact location is never requested.</p>`;
}
function routeRows() {
  const f = S.fallback, r = f.route;
  return r.status === "ok" ? r.rows : (f.fb.options || []).filter(o => o.type !== "compost");
}
function routeResultsHtml() {
  const f = S.fallback, r = f.route, inedible = f.fb.inedible_confirmed === true || S.myListings.some(l => l.id === f.id && l.inedible_confirmed === true);
  const directory = (f.fb.options || []).filter(o => o.type !== "compost");
  let status, top = "";
  if (f.routingDown) status = `<p class="route-status muted" role="status">${esc(r.status === "unavailable" && r.error ? r.error : "Live driving times aren't available right now.")} The verified spots below still have addresses, hours and official links.</p>`;
  else if (r.status === "loading") status = `<p class="route-status" role="status" aria-live="polite">Finding live drive times from ${esc(r.area.trim())}...</p>`;
  else if (r.status === "ok") status = `<p class="route-status ok" role="status" aria-live="polite">${r.rows.length} verified spot${r.rows.length === 1 ? "" : "s"} within ${esc(r.searchedMax)} min of ${esc(r.origin?.label || r.searchedArea)}, closest first. Times are live car estimates.</p>`;
  else if (r.status === "empty") status = `<p class="route-status" role="status" aria-live="polite">Search finished for ${esc(r.origin?.label || r.searchedArea)}.</p>`;
  else if (r.status === "error") { status = `<p class="route-status" role="status">Showing the full verified list without drive times.</p>`; top = `${sheetError(r.error)}${r.area.trim() ? `<button type="button" class="btn btn-secondary btn-sm route-retry" data-action="route-retry">Try the search again</button>` : ""}`; }
  else status = `<p class="route-status muted" role="status">Enter a city or ZIP to sort these by live drive time.</p>`;
  if (r.status === "loading") return `${status}<div class="dn-map-wrap"><div class="skel dn-map"></div></div><div class="skel" style="height:150px"></div><div class="skel" style="height:150px"></div>`;
  if (r.status === "empty") return `${status}<div class="route-empty"><strong>No verified spot within ${esc(r.searchedMax)} minutes by car.</strong><p>${f.browse ? "Try a longer drive limit or another area." : "Try a longer drive limit, another area, a swap, or giving it away. We won't suggest a drop-off that isn't verified."}</p></div>
    <details class="more"><summary>See the full verified list without drive times${icon("chevD", 16)}</summary><div class="dn-cards">${directory.map(o => destCard(o, inedible, f.err)).join("")}</div></details>`;
  const rows = routeRows(), pins = new Map(); rows.filter(hasPt).forEach((o, i) => pins.set(String(o.id), i + 1));
  const showMap = pins.size > 0 || (r.status === "ok" && hasPt(r.origin));
  return `${status}${top}${showMap ? `<div class="dn-map-wrap"><div id="dn-map" class="dn-map" role="region" aria-label="Map of ${f.browse ? "donation locations" : "verified donation spots"}. Numbered pins match the cards below."></div><p id="dn-map-status" class="map-note">Map data &copy; OpenStreetMap contributors${r.status === "ok" ? " · Drive times by openrouteservice" : ""}. The map shows places, not acceptance.</p></div>` : ""}
    <div class="dn-cards">${rows.map(o => destCard(o, inedible, f.err, pins.get(String(o.id)) || 0)).join("")}</div>`;
}
function mountDMap() {
  destroyDMap();
  const c = $("#dn-map"), f = S.fallback; if (!c || !f) return;
  try {
    dMap = createDonationMap(c, routeRows(), f.route.status === "ok" ? f.route.origin : null, {
      onSelect: id => selectDest(id, "map"),
      onTilesUnavailable: () => { const s = $("#dn-map-status"); if (s) s.textContent = "Map tiles are unavailable right now. The verified cards below still work."; }
    });
    if (dMap && f.sel) dMap.select(f.sel, false);
  } catch { const s = $("#dn-map-status"); if (s) s.textContent = "The map couldn't load. The verified cards below still work."; }
}
function renderFallback() { destroyDMap(); setSheetBody(fallbackBody()); mountDMap(); }
function renderRouteResults() {
  const box = $("#dn-results"); if (!box || !S.fallback) return;
  destroyDMap(); box.innerHTML = routeResultsHtml(); mountDMap();
  const go = $("#route-go"), r = S.fallback.route;
  if (go) { go.disabled = S.fallback.routingDown || r.status === "loading"; go.textContent = r.status === "loading" ? "Searching" : "Find drive times"; }
}
function selectDest(id, from) {
  if (!S.fallback) return; id = String(id); S.fallback.sel = id;
  let card = null;
  document.querySelectorAll("#sheet [data-dest-card]").forEach(c => { const on = c.dataset.destCard === id; c.classList.toggle("selected", on); if (on) { c.setAttribute("aria-current", "true"); card = c; } else c.removeAttribute("aria-current"); });
  dMap?.select(id, from !== "map");
  if (from === "map" && card) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function resetRoute() {
  const f = S.fallback; if (!f) return; const r = f.route;
  r.seq = 0; routeSeq++;
  if (r.status === "idle" || r.status === "unavailable") return;
  Object.assign(r, { status: "idle", rows: [], origin: null, error: "" }); f.sel = null; renderRouteResults();
}
async function runRouteSearch() {
  const f = S.fallback; if (!f || f.routingDown) return; const r = f.route, area = r.area.trim(), max = r.max;
  if (!area) { Object.assign(r, { status: "error", error: "Enter a city or ZIP code first.", rows: [], origin: null }); renderRouteResults(); $("#route-area")?.focus(); return; }
  const seq = ++routeSeq; r.seq = seq;
  Object.assign(r, { status: "loading", rows: [], origin: null, error: "" }); f.sel = null; renderRouteResults();
  const stale = () => S.fallback !== f || r.seq !== seq || (!f.browse && !S.user) || !sheetOpen() || r.area.trim() !== area || r.max !== max;
  try {
    const res = await post(f.browse ? "/donation-locations/routes" : `/listings/${encodeURIComponent(f.id)}/donation-routes`, { area, max_drive_minutes: max });
    if (stale()) return;
    const rows = (res.destinations || []).filter(d => d && d.id != null && Number.isFinite(d.drive_minutes));
    Object.assign(r, { rows, origin: res.origin || null, status: rows.length ? "ok" : "empty", searchedMax: res.max_drive_minutes ?? max, searchedArea: area });
  } catch (e) {
    if (stale()) return;
    if (e.status === 503) { f.routingDown = true; Object.assign(r, { status: "unavailable", error: e.message }); }
    else Object.assign(r, { status: "error", error: e.message });
  }
  renderRouteResults();
}
document.addEventListener("input", e => { if (e.target.id === "route-area" && S.fallback) { S.fallback.route.area = e.target.value; resetRoute(); } });
document.addEventListener("change", e => {
  if (e.target.id !== "route-max" || !S.fallback) return;
  S.fallback.route.max = Number(e.target.value); resetRoute();
  if (S.fallback.route.area.trim() && !S.fallback.routingDown) runRouteSearch();
});
document.addEventListener("click", e => {
  const c = e.target.closest?.("#sheet [data-dest-card]");
  if (c && !e.target.closest("a,button,input,label,summary,select")) selectDest(c.dataset.destCard, "card");
});
document.addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches?.("#sheet [data-dest-card]")) { e.preventDefault(); selectDest(e.target.dataset.destCard, "card"); }
});

/* ---------------- Data loading ---------------- */
async function load(quiet = false) {
  try { const d = await api("/listings"); S.listings = d.listings || []; S.loaded = true; S.loadError = ""; }
  catch (e) { S.loadError = e.message; S.loaded = true; }
  if (S.user) await refreshActivity(true);
  if (!quiet || !userIsTyping()) { renderNav(); if (S.tab === "discover" || S.tab === "activity") render(); }
  if (S.tab === "impact") refreshImpact();
}
async function refreshActivity(skipRender = false) {
  if (!S.user) return;
  const [l, o, r, n] = await Promise.allSettled([api("/listings?mine=true"), api("/offers"), api("/requests"), api("/notifications")]);
  if (l.status === "fulfilled") S.myListings = (l.value.listings || []).filter(x => x.user_id === S.user?.id || x.owner_id === S.user?.id || x.user_id == null);
  if (o.status === "fulfilled") S.myOffers = o.value.offers || [];
  if (r.status === "fulfilled") S.myRequests = r.value.requests || [];
  if (n.status === "fulfilled") S.notifications = n.value.notifications || [];
  S.activityLoaded = true;
  if (!skipRender) { renderNav(); if (S.tab === "activity" && !userIsTyping()) render(); }
}
async function refreshImpact() {
  const uid = S.user?.id, gen = ++S.impactGen;
  if (!uid) { S.impact = null; S.impactError = ""; if (S.tab === "impact") render(); return; }
  try {
    const result = await api("/impact");
    if (S.user?.id !== uid || gen !== S.impactGen) return;
    S.impact = result; S.impactError = "";
  } catch (e) {
    if (S.user?.id !== uid || gen !== S.impactGen) return;
    S.impact = null; S.impactError = e.message;
  }
  if (S.tab === "impact") render();
}
async function checkHealth() {
  const b = $("#setup-banner");
  try { const h = await api("/health"); const s = h.setup_required || []; b.hidden = !s.length; if (s.length) b.innerHTML = `<strong>Setup incomplete.</strong> Some features are unavailable:<ul>${s.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`; }
  catch (e) { b.hidden = false; b.textContent = `The server health check failed: ${e.message}`; }
}
async function act(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
  catch (e) { toast(e.message); if (e.status === 409) await load(); }
  finally { await refreshActivity(); refreshImpact(); }
}

/* ---------------- Actions ---------------- */
const actions = {
  "tab": el => goTab(el.dataset.tab),
  "go-share": () => { if (S.share.step === "review" && !S.editingId && !S.share.fromBob && !S.photo) S.share.step = "compose"; goTab("share"); },
  "reload": () => { S.loaded = false; S.loadError = ""; render(); load(); },
  "reload-impact": () => { S.impactError = ""; S.impact = null; render(); refreshImpact(); },
  "filter-mode": el => { S.filter.mode = el.dataset.value; render(); },
  "clear-filters": () => { S.filter = { mode: "", hours: 0 }; render(); },
  "open-hours": openHours, "open-rules": openRules,
  "set-hours": el => { S.filter.hours = Number(el.dataset.value) || 0; closeSheet(); render(); },
  "open-listing": el => openListing(el.dataset.id),
  "ask-giveaway": el => { const l = findListing(el.dataset.id); requireAuth(() => openSheet("Ask for this giveaway", giveawayBody(l), listingTitle(l))); },
  "allergen-toggle": el => {
    S.draft.allergens = toggleAllergen(S.draft.allergens, el.dataset.value);
    S.publishError = ""; invalidateApproval(true); render();
  },
  "offer-swap": el => requireAuth(() => {
    const mine = S.myListings.filter(x => x.status === "open" && x.mode === "exchange");
    if (mine.length) { toast("Swaps come from your own listing. Checking your matches…"); openFallback(mine[0].id); return; }
    openSheet("List your food first", `<p style="margin:0;font-size:15.5px;line-height:1.45">Swaps are matched from your own listing. List what you have and what you'd like, and RePlate finds swaps when the foods and times line up.</p><button type="button" class="btn btn-primary btn-block" data-action="go-share">List my food</button>`);
  }),
  "open-request": () => requireAuth(openRequestForm),
  "open-signin": () => openSignIn(),
  "auth-mode": el => { setSheetBody(authBody(el.dataset.value)); const h = $("#sheet-title"); if (h) h.textContent = el.dataset.value === "signup" ? "Join RePlate" : "Welcome back"; },
  "open-account": openAccount,
  "sign-out": async () => { resetEditor(true); try { await post("/auth/logout"); } catch {} signedOut(); closeSheet(); toast("Signed out."); await load(); },
  "delete-account": () => openConfirm({ title: "Delete your account?", text: "This turns off sign-in and hides your active listings.", confirm: "Delete account", danger: true, onConfirm: async () => { try { await api("/auth/account", { method: "DELETE" }); signedOut(); closeSheet(); toast("Account deactivated."); await load(); } catch (e) { toast(e.message); } } }),
  "close-sheet": () => closeSheet(),
  "confirm-yes": async el => { el.disabled = true; const fn = confirmFn; confirmFn = null; closeSheet(); if (fn) await fn(); },
  "pick-photo": () => $("#photo-input").click(),
  "retry-photo": () => S.user ? uploadSelectedPhoto() : openSignIn(),
  "remove-photo": () => { S.uploadGen++; S.photoBusy = false; discardPhoto(S.photo); S.photo = null; S.photoStatus = "Photo removed. A photo is required to publish."; photoChanged(); },
  "interpret": doInterpret,
  "manual": () => { if (!S.editingId) { S.draft = emptyDraft(); S.dtTouched = false; } S.share.fromBob = false; S.share.notes = []; S.share.step = "review"; render(); window.scrollTo(0, 0); invalidateApproval(false); },
  "back-compose": () => { if (S.editingId) return actions["cancel-edit"](); S.share.step = "compose"; render(); window.scrollTo(0, 0); },
  "cancel-edit": () => { resetEditor(true); S.share = { step: "compose", text: "", busy: false, error: "", fromBob: false, notes: [] }; toast("Editing cancelled. Your saved listing is unchanged."); goTab("activity"); },
  "add-item": () => { if (S.draft.items.length < MAX_ITEMS) { S.draft.items.push(emptyItem()); render(); invalidateApproval(true); $(`#it-${S.draft.items.length - 1}-name`)?.focus(); } },
  "remove-item": el => { S.draft.items.splice(Number(el.dataset.idx), 1); render(); invalidateApproval(true); },
  "set-mode": el => { S.draft.mode = el.dataset.value; render(); invalidateApproval(true); },
  "review": doReview,
  "publish": doPublish,
  "act-seg": el => { S.actSeg = el.dataset.value; render(); },
  "edit-listing": el => { const l = findListing(el.dataset.id); if (l) { closeSheet(); editListing(l); } },
  "withdraw": el => openConfirm({ title: "Withdraw this listing?", text: "It will stop showing to neighbors. You can't undo this.", confirm: "Withdraw", danger: true, onConfirm: () => act(() => api(`/listings/${encodeURIComponent(el.dataset.id)}`, { method: "DELETE" }), "Listing withdrawn.").then(load) }),
  "offer-respond": async el => {
    el.disabled = true; const accept = el.dataset.accept === "1", id = el.dataset.id;
    const r = await act(() => post(`/offers/${encodeURIComponent(id)}/respond`, { accept }), accept ? "You accepted the swap." : "Swap declined.");
    if (r && !accept) { const o = r.offer || S.myOffers.find(x => x.id === id); const own = o && (S.myListings.some(l => l.id === o.listing_id) ? o.listing_id : S.myListings.some(l => l.id === o.match_id) ? o.match_id : null); if (own) openFallback(own); }
  },
  "offer-cancel": el => openConfirm({ title: "Cancel this swap?", text: "The other person will be told it's cancelled.", confirm: "Cancel swap", danger: true, onConfirm: () => act(() => post(`/offers/${encodeURIComponent(el.dataset.id)}/cancel`), "Swap cancelled.") }),
  "offer-pickup": el => openConfirm({ title: "Did the handoff happen?", text: "Confirm only if you personally completed this handoff. It counts once both of you confirm.", confirm: "Yes, it happened", onConfirm: () => act(() => post(`/offers/${encodeURIComponent(el.dataset.id)}/confirm-pickup`), "Thanks. Your confirmation is saved.") }),
  "rate-offer": el => { const o = S.myOffers.find(x => x.id === el.dataset.id); const other = [...(o?.participants || []).map(uid), o?.owner_id, o?.match_owner_id, o?.user_id, o?.match_user_id].find(x => x && x !== S.user.id); if (!other) return toast("Couldn't find your swap partner."); openRate({ offer_id: o.id, to_user_id: other }, offerSides(o).otherName); },
  "gr-decide": el => { el.disabled = true; act(() => post(`/giveaway-requests/${encodeURIComponent(el.dataset.id)}/decision`, { accept: el.dataset.accept === "1" }), el.dataset.accept === "1" ? "Request approved." : "Request declined."); },
  "gr-pickup": el => openConfirm({ title: "Did the handoff happen?", text: "Confirm only if you personally completed this handoff. It counts once both of you confirm.", confirm: "Yes, it happened", onConfirm: () => act(() => post(`/giveaway-requests/${encodeURIComponent(el.dataset.id)}/pickup`), "Thanks. Your confirmation is saved.") }),
  "gr-cancel": el => openConfirm({ title: "Cancel this request?", text: "The other person will be told it's cancelled.", confirm: "Cancel request", danger: true, onConfirm: () => act(() => post(`/giveaway-requests/${encodeURIComponent(el.dataset.id)}/cancel`), "Request cancelled.") }),
  "rate-gr": el => openRate({ request_id: el.dataset.id, to_user_id: el.dataset.to }, "this handoff"),
  "set-star": el => { S.rating.stars = Number(el.dataset.value); setSheetBody(rateBody()); },
  "save-rating": async el => { el.disabled = true; try { await post("/ratings", { ...S.rating.body, stars: S.rating.stars }); closeSheet(); toast("Rating saved. Thanks!"); } catch (e) { el.disabled = false; toast(e.message); } },
  "report-user": el => requireAuth(() => openSheet("Report this user", `<label class="sr-only" for="report-reason">Reason</label><textarea id="report-reason" class="plain" maxlength="500" placeholder="What happened?"></textarea><div id="report-err"></div><button type="button" class="btn btn-primary btn-block" data-action="send-report" data-id="${esc(el.dataset.id)}">Send report</button>`)),
  "send-report": async el => { const reason = $("#report-reason").value.trim(); if (!reason) { $("#report-err").innerHTML = sheetError("Tell us what happened."); return; } el.disabled = true; try { await post(`/users/${encodeURIComponent(el.dataset.id)}/report`, { reason }); closeSheet(); toast("Report received. Thank you."); } catch (e) { el.disabled = false; $("#report-err").innerHTML = sheetError(e.message); } },
  "block-user": el => requireAuth(() => openConfirm({ title: "Block this user?", text: "Their listings won't be matched with yours.", confirm: "Block", danger: true, onConfirm: async () => { try { await post(`/users/${encodeURIComponent(el.dataset.id)}/block`); toast("User blocked."); await load(); } catch (e) { toast(e.message); } } })),
  "open-fallback": el => openFallback(el.dataset.id),
  "open-donation-locations": openDonationLocations,
  "route-retry": () => runRouteSearch(),
  "propose": async el => { const m = S.fallback.fb.matches[Number(el.dataset.idx)], id = S.fallback.id; el.disabled = true; const r = await act(() => post("/offers", { listing_id: id, match_id: m.listing?.id || m.match_id }), "Swap offer sent. You both need to accept."); if (r) closeSheet(); else openFallback(id); },
  "fb-giveaway": () => { const id = S.fallback.id, l = findListing(id); if (!l) return toast("Couldn't load this listing. Refresh and try again."); closeSheet(); editListing(l, { mode: "giveaway" }); },
  "confirm-inedible": async el => {
    if (!$("#inedible-check").checked) { S.fallback.err.inedible = "Tick the box to confirm first."; return renderFallback(); }
    el.disabled = true; const id = S.fallback.id;
    if (await act(() => api(`/listings/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ inedible_confirmed: true }) }), "Marked as not edible.")) { await load(true); openFallback(id); }
  },
  "record-outcome": async el => {
    const oid = el.dataset.id, compost = el.dataset.type === "compost", id = S.fallback.id;
    const fz = document.querySelector(`[data-feasible="${CSS.escape(oid)}"]`), cb = document.querySelector(`[data-drop="${CSS.escape(oid)}"]`);
    if (!fz?.checked) { S.fallback.err[oid] = "Confirm the food is accepted there and you can get there."; return renderFallback(); }
    if (!cb?.checked) { S.fallback.err[oid] = "Confirm you actually dropped it off."; return renderFallback(); }
    const body = { listing_id: id, destination_id: oid, action: compost ? "compost" : "donation", confirmed: true, destination_feasible_confirmed: true };
    if (!compost) body.no_glass_confirmed = true; else Object.assign(body, { inedible_confirmed: true, material: "fruit_vegetable_scraps" });
    el.disabled = true;
    if (await act(() => post("/outcomes", body), compost ? "Compost drop-off recorded. Thanks!" : "Donation recorded. Thanks!")) { closeSheet(); load(true); }
    else el.disabled = false;
  }
};

document.addEventListener("click", e => {
  const el = e.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) { e.preventDefault(); fn(el); }
});
function onBind(e) {
  const el = e.target, path = el.dataset?.bind; if (!path) return;
  const val = el.type === "checkbox" ? el.checked : el.value;
  const keys = path.split("."); let o = S; keys.slice(0, -1).forEach(k => { o = o[k]; });
  const previous = o[keys.at(-1)];
  o[keys.at(-1)] = val;
  if (!path.startsWith("draft.")) return;
  // Safari/autofill may emit change without input; handle both, but don't
  // discard an approval or replace its button for the same committed value.
  if (path === "draft.deadline") S.dtTouched = true;
  if (previous === val || (el.type !== "checkbox" && String(previous ?? "") === String(val))) {
    if (el.dataset.rerender && e.type === "change") render();
    return;
  }
  if (path === "draft.allergen_other") {
    S.draft.allergens = allergenValue(parseAllergens(S.draft.allergens).selected, val);
  }
  if (/^draft\.items\.\d+\.condition$/.test(path) && val === "produce" &&
      S.draft.items.every(it => it.condition === "produce")) S.draft.allergens = "None";
  // An explicit Clear is a user choice too; do not auto-fill it again.
  if (path === "draft.deadline") S.dtTouched = true;
  if (path === "draft.day") {
    const lim = pickupLimits();
    ["#f-from", "#f-until"].forEach(sel => {
      const input = $(sel); if (!input) return;
      input.min = val === lim.minDay ? lim.minInput.slice(11) : "00:00";
      input.max = val === lim.maxDay ? lim.maxInput.slice(11) : "23:59";
    });
  }
  if ((path === "draft.day" || path === "draft.until") && !S.dtTouched && S.draft.day && S.draft.until) {
    S.draft.deadline = `${S.draft.day}T${S.draft.until}`; const dl = $("#f-deadline"); if (dl) dl.value = S.draft.deadline;
  }
  if (el.dataset.rerender && e.type === "change") { S.publishError = ""; render(); invalidateApproval(true); return; }
  S.publishError = "";
  invalidateApproval(true);
}
document.addEventListener("input", onBind);
function updateSpotCounter(e) {
  const id = e.target.dataset?.spotCounter;
  if (id) { const counter = document.getElementById(id); if (counter) counter.textContent = `${e.target.value.length}/${SPOT_MAX}`; }
}
document.addEventListener("input", updateSpotCounter);
document.addEventListener("change", updateSpotCounter);
document.addEventListener("change", onBind);
document.addEventListener("keydown", e => { if (e.key === "Escape" && sheetOpen()) closeSheet(); });

document.addEventListener("submit", async e => {
  const f = e.target;
  if (f.id === "auth-form") {
    e.preventDefault();
    const mode = f.dataset.mode, s = mode === "signup", v = new FormData(f), email = String(v.get("email") || "").trim(), password = String(v.get("password") || ""), name = String(v.get("display_name") || "").trim();
    if (s && !name) return setSheetBody(authBody(mode, "Add your first name so neighbors know who they're meeting."));
    if (!email.includes("@")) return setSheetBody(authBody(mode, "Enter a valid email address."));
    if (password.length < 8) return setSheetBody(authBody(mode, "Use a password with at least 8 characters."));
    setSheetBody(authBody(mode, "", true));
    try {
      const r = await post(`/auth/${s ? "signup" : "login"}`, s ? { display_name: name, email, password } : { email, password });
      if (r.email_confirmation_required) return setSheetBody(authBody("login", "", false, "Check your email to confirm your account, then sign in."));
      S.impactGen++; S.impact = null; S.impactError = ""; S.user = r.user; if (S.photo?.file) S.photo.guestDraft = false;
      closeSheet(); renderAll(); toast(s ? "Welcome to RePlate." : "You're signed in.");
      if (S.photo?.file && !S.photo.id) uploadSelectedPhoto();
      await load();
      if (S.tab === "impact") refreshImpact();
      const next = S.pendingAfterAuth; S.pendingAfterAuth = null; if (next) next();
    } catch (er) { setSheetBody(authBody(mode, er.message)); }
  }
  if (f.id === "route-form") { e.preventDefault(); if (S.fallback) { S.fallback.route.area = f.area.value; S.fallback.route.max = Number(f.max_drive_minutes.value); runRouteSearch(); } return; }
  if (f.id === "giveaway-form") {
    e.preventDefault();
    const l = findListing(f.dataset.id), vals = { location: f.location.value, pickup_start: f.pickup_start.value, pickup_end: f.pickup_end.value };
    const s = toUtcIso(vals.pickup_start), en = toUtcIso(vals.pickup_end);
    if (spotError(vals.location)) return setSheetBody(giveawayBody(l, spotError(vals.location), false, vals));
    if (!vals.location || !s || !en) return setSheetBody(giveawayBody(l, "Choose a pickup spot and an exact time window.", false, vals));
    const ge = windowErrors({ start: s, end: en, bound: { start: l.pickup_start, end: l.pickup_end, deadline: l.deadline } });
    if (ge.length) return setSheetBody(giveawayBody(l, ge.join(" "), false, vals));
    setSheetBody(giveawayBody(l, "", true, vals));
    try { await post(`/listings/${encodeURIComponent(l.id)}/requests`, { pickup_start: s, pickup_end: en, location: vals.location }); closeSheet(); toast(`Request sent. ${l.name || "The owner"} decides.`); S.actSeg = "getting"; refreshActivity(); }
    catch (er) { setSheetBody(giveawayBody(l, er.message, false, vals)); }
  }
  if (f.id === "request-form") {
    e.preventDefault();
    const q = parseQty(f.quantity.value), ps = toUtcIso(f.pickup_start.value), pe = toUtcIso(f.pickup_end.value), dl = toUtcIso(f.deadline.value), errEl = $("#rq-err");
    const err = !f.item.value.trim() ? "Add the food you're looking for." : qtyError(f.quantity.value) || spotError(f.location.value)
      || (!f.location.value || !ps || !pe || !dl ? "Choose a pickup spot, a pickup window and a needed-by time."
      : windowErrors({ start: ps, end: pe, deadline: dl, needDeadline: true, labels: { deadline: "Needed by" } }).join(" "));
    if (err) { errEl.innerHTML = sheetError(err); return; }
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
    try { await post("/requests", { items: [f.item.value.trim()], quantity: q, unit: CANON_UNIT, location: f.location.value, pickup_start: ps, pickup_end: pe, deadline: dl, timezone: TZ }); closeSheet(); toast("Request posted. We'll let you know when it's listed nearby."); S.actSeg = "getting"; refreshActivity(); }
    catch (er) { btn.disabled = false; errEl.innerHTML = sheetError(er.message); }
  }
});

function signedOut() {
  if (!S.fallback?.browse) { routeSeq++; fbSeq++; if (S.fallback) { destroyDMap(); closeSheet(); S.fallback = null; } }
  S.user = null; S.impactGen++; S.impact = null; S.impactError = ""; S.myListings = []; S.myOffers = []; S.myRequests = []; S.notifications = []; S.activityLoaded = false;
  if (S.editingId || (S.photo && !S.photo.guestDraft) || S.approval || S.reviewing) { resetEditor(false); S.share.step = "compose"; }
  renderAll();
}

/* ---------------- Start ---------------- */
async function initialize() {
  const h = location.hash.replace("#", "");
  if (TABS.some(t => t.id === h)) S.tab = h;
  renderAll(); checkHealth();
  try { S.user = (await api("/auth/me")).user || null; } catch { S.user = null; }
  renderAll(); await load();
  if (S.tab === "impact") refreshImpact();
}
initialize();
setInterval(() => { if (!document.hidden) load(true); }, 15000);
