const API = "/api";
const ZONES = ["Library steps","Community Center","Neighborhood Park","Student Union","Campus Green","Dining Commons"];
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const $ = s => document.querySelector(s);
const listingsEl = $("#listings"), form = $("#listing-form"), notice = $("#form-notice"), offerArea = $("#offer-area"), toast = $("#toast");
let listings = [], myListings = [], myOffers = [], myRequests = [], sessionUser = null, authMode = "login", toastTimer, loaded = false;
const inedible = new Set();

function esc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
async function api(path, options = {}) {
  let res;
  try { res = await fetch(`${API}${path}`, {credentials:"include", headers:{"Content-Type":"application/json"}, ...options}); }
  catch { throw Error("Cannot reach the EchoPantry server. Check your connection and try again."); }
  let data = {}; try { data = await res.json(); } catch {}
  if (!res.ok) { const e = Error(data.error || `Request failed (${res.status}).`); e.status = res.status; throw e; }
  return data;
}
const post = (p, body = {}) => api(p, {method:"POST", body:JSON.stringify(body)});
function showToast(m) { toast.textContent = m; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 3200); }
function toUtcIso(v) { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
function fmt(v) { const d = new Date(v); return !v || Number.isNaN(d.getTime()) ? "Not set" : d.toLocaleString(undefined,{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}); }
function windowText(a, b) { return a && b ? `${fmt(a)} to ${fmt(b)}` : "No window set"; }
function itemsOf(l) { if (Array.isArray(l?.item_details) && l.item_details.length) return l.item_details; if (Array.isArray(l?.items)) return l.items.map(x => typeof x === "string" ? {name:x, quantity:l.quantities?.[x] ?? null, unit:null} : x); return []; }
function itemText(i) { if (typeof i === "string") return esc(i); const q = i.quantity != null ? `${i.quantity}${i.unit ? " " + i.unit : ""} ` : ""; return esc(q + i.name) + (i.printed_date ? ` <small>(${esc(i.date_type || "date")}: ${esc(i.printed_date)})</small>` : ""); }
function itemList(arr) { return (arr || []).map(itemText).join(", ") || "None listed"; }
function status(s) { return `<span class="status ${esc(s)}">${esc(String(s || "").replaceAll("_"," "))}</span>`; }
function isMine(listingId) { return myListings.some(l => l.id === listingId); }
function setNotice(el, msg, ok) { el.className = ok ? "notice success" : "notice"; el.textContent = msg; el.hidden = false; }

document.querySelectorAll(".zone-select").forEach(sel => { sel.innerHTML = `<option value="" disabled selected>Choose a public zone</option>` + ZONES.map(z => `<option>${z}</option>`).join(""); });
$("#location-filter").innerHTML += ZONES.map(z => `<option>${z}</option>`).join("");

/* Health */
async function checkHealth() {
  const b = $("#setup-banner");
  try { const h = await api("/health"); const s = h.setup_required || [];
    b.hidden = !s.length; if (s.length) b.innerHTML = `<strong>Setup incomplete.</strong> Some features are unavailable:<ul>${s.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
  } catch (e) { b.hidden = false; b.textContent = `Server health check failed: ${e.message}`; }
}

/* Listings */
function art(items) { const all = items.map(i => i.name || i).join(" ").toLowerCase(); const pkg = items.some(i => i.category === "shelf_stable"); return pkg ? `<span class="dot pkg"></span><span class="dot c"></span>` : /apple|tomato|pepper/.test(all) ? `<span class="dot b"></span><span class="dot"></span><span class="dot c"></span>` : `<span class="dot"></span><span class="dot c"></span>`; }
function renderListings() {
  const mode = $("#mode-filter").value, loc = $("#location-filter").value, hours = Number($("#deadline-filter").value) || 0;
  const cutoff = hours ? Date.now() + hours * 3600000 : Infinity;
  const visible = listings.filter(x => x.status === "open" && (!mode || x.mode === mode) && (!loc || x.location === loc) && new Date(x.deadline).getTime() <= cutoff);
  if (!visible.length) { listingsEl.innerHTML = `<div class="empty-listings">${loaded ? "No open listings match these filters. Be the first to share." : "Loading listings..."}</div>`; return; }
  listingsEl.innerHTML = visible.map(l => {
    const items = itemsOf(l), give = l.mode === "giveaway", owner = sessionUser && sessionUser.id === l.user_id;
    const wanted = l.wanted_food ? `${l.wanted_quantity ?? ""} ${l.wanted_unit ?? ""} ${l.wanted_food}`.trim() : (l.wants || []).join(", ");
    return `<article class="listing-card"><div class="card-art ${give ? "" : "orange"}"><span class="urgency ${give ? "gift-tag" : ""}">${give ? "Free giveaway" : "Exchange"}</span><span class="produce" aria-hidden="true">${art(items)}</span></div><div class="card-body"><div class="owner-row"><span class="owner"><span class="avatar" aria-hidden="true">${esc((l.name || "C").charAt(0).toUpperCase())}</span>${esc(l.name || "Community member")} &middot; ${esc(l.location)}</span><span class="rating">${l.rating ? Number(l.rating).toFixed(1) + " rating" : "New"}</span></div><div class="bundle-label">${items.length > 1 ? `BUNDLE &middot; ${items.length} ITEMS` : "SINGLE ITEM"}</div><div class="chips">${items.map(i => `<span class="chip">${itemText(i)}</span>`).join("")}</div>${!give && wanted ? `<div class="wants-label">HOPING TO FIND</div><div class="chips wants"><span class="chip">${esc(wanted)}</span></div>` : ""}<p class="deadline">Pickup ${esc(windowText(l.pickup_start, l.pickup_end))}</p>${l.allergens ? `<p class="deadline">Allergens: ${esc(l.allergens)}</p>` : ""}<div class="card-bottom"><span class="deadline">Until <strong>${esc(fmt(l.deadline))}</strong></span><button class="swap-button" data-act="${owner ? "manage" : give ? "giveaway" : "exchange"}" data-id="${esc(l.id)}">${owner ? "Next steps" : give ? "Request item" : "Match my listing"}</button></div>${!owner ? `<div class="trust-actions"><button data-report="${esc(l.user_id)}">Report</button><button data-block="${esc(l.user_id)}">Block user</button></div>` : ""}</div></article>`;
  }).join("");
}
listingsEl.addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  if (!sessionUser) return openAuth();
  if (b.dataset.act === "manage") return openFallback(b.dataset.id);
  if (b.dataset.act === "giveaway") return openGiveawayDialog(b.dataset.id);
  if (b.dataset.act === "exchange") { const mine = myListings.filter(l => l.status === "open" && l.mode === "exchange"); if (!mine.length) { showToast("Create an exchange listing first; matches come from your own listing."); $("#create").scrollIntoView(); return; } showToast("Checking matches for your open exchange listings."); return openFallback(mine[0].id); }
  if (b.dataset.report) { const reason = prompt("Why are you reporting this user?"); if (!reason) return; try { await post(`/users/${encodeURIComponent(b.dataset.report)}/report`, {reason}); showToast("Report received."); } catch (er) { showToast(er.message); } }
  if (b.dataset.block) { if (!confirm("Block this user?")) return; try { await post(`/users/${encodeURIComponent(b.dataset.block)}/block`); showToast("User blocked."); await load(); } catch (er) { showToast(er.message); } }
});
document.querySelectorAll("#mode-filter,#location-filter,#deadline-filter").forEach(f => f.addEventListener("change", renderListings));

async function load() {
  try { const d = await api("/listings"); listings = d.listings || []; loaded = true; renderListings(); }
  catch (e) { listingsEl.innerHTML = `<div class="empty-listings">Could not load listings: ${esc(e.message)} <button class="mini-btn" id="retry-load">Retry</button></div>`; $("#retry-load").onclick = load; }
  refreshImpact();
  if (sessionUser) { refreshActivity(); refreshNotifications(); }
}

/* Impact */
async function refreshImpact() {
  try { const d = await api("/impact");
    $("#trades-done").textContent = d.completed_trades ?? 0; $("#giveaways-done").textContent = d.completed_giveaways ?? 0;
    $("#donated-items").textContent = d.donations_reported ?? 0; $("#compost-items").textContent = d.compost_reported ?? 0;
    const q = d.quantities || [], food = q.filter(x => x.action !== "compost"), comp = q.filter(x => x.action === "compost");
    const li = arr => arr.map(x => `<li>${esc(x.quantity)} ${esc(x.unit)} ${esc(x.name)} <small>(${esc(String(x.action).replaceAll("_"," "))}${x.action === "donation" || x.action === "compost" ? ", user-reported" : ""})</small></li>`).join("");
    $("#impact-detail").innerHTML = `${food.length ? `<strong>Food shared for people</strong><ul>${li(food)}</ul>` : ""}${comp.length ? `<strong>Composted (separate, user-reported)</strong><ul>${li(comp)}</ul>` : ""}${d.note ? `<p>${esc(d.note)}</p>` : ""}`;
  } catch { $("#impact-detail").textContent = "Impact ledger unavailable right now."; }
}

/* Activity */
async function refreshActivity() {
  if (!sessionUser) return;
  const [l, o, r] = await Promise.allSettled([api("/listings?mine=true"), api("/offers"), api("/requests")]);
  if (l.status === "fulfilled") myListings = (l.value.listings || []).filter(x => x.user_id === sessionUser?.id || x.owner_id === sessionUser?.id || x.user_id == null);
  if (o.status === "fulfilled") myOffers = o.value.offers || [];
  if (r.status === "fulfilled") myRequests = r.value.requests || [];
  renderActivity();
  if ([l, o, r].some(x => x.status === "rejected")) showToast("Some of your activity could not be refreshed.");
}
function renderActivity() {
  const signed = Boolean(sessionUser); $("#activity-grid").hidden = !signed; $("#activity-guest").hidden = signed;
  if (!signed) { $("#my-requests").innerHTML = `<p class="muted">Sign in to see your requests.</p>`; return; }
  $("#my-listings").innerHTML = myListings.length ? myListings.map(l => `<div class="record"><strong>${l.mode === "giveaway" ? "Giveaway" : "Exchange"}</strong>${status(l.status)}<p>${itemList(itemsOf(l))}</p><p>${esc(l.location)} &middot; ${esc(windowText(l.pickup_start, l.pickup_end))}</p><div class="row-actions">${["open","expired","withdrawn"].includes(l.status) ? `<button class="mini-btn" data-fallback="${esc(l.id)}">${l.status === "open" ? "Matches and next steps" : "Next steps"}</button>` : ""}${l.status === "open" ? `<button class="mini-btn danger" data-withdraw="${esc(l.id)}">Withdraw</button>` : ""}</div></div>`).join("") : `<p class="muted">You have not listed anything yet.</p>`;
  const giveaways = myRequests.filter(r => r.requester_id || r.listing_id && r.owner_id);
  const standalone = myRequests.filter(r => !giveaways.includes(r));
  const offerHtml = myOffers.map(offerCard).join("");
  const gHtml = giveaways.map(giveawayCard).join("");
  $("#my-handoffs").innerHTML = offerHtml + gHtml || `<p class="muted">No handoffs yet.</p>`;
  $("#my-requests").innerHTML = standalone.length ? standalone.map(r => `<div class="record"><strong>${esc(r.quantity ?? "")} ${esc(r.unit ?? "")} ${esc((r.items || []).join(", ") || r.item || "")}</strong>${status(r.status || "open")}<p>${esc(r.location)} &middot; ${esc(windowText(r.pickup_start, r.pickup_end))}</p><p>Needed by ${esc(fmt(r.deadline))}</p></div>`).join("") : `<p class="muted">No requests posted.</p>`;
}
function uid(x) { return x?.user_id || x?.id || x; }
function offerCard(o) {
  const me = sessionUser.id, acc = (o.accepted_by || []).map(uid), done = (o.completed_by || []).map(uid);
  const s = o.status, iAccepted = acc.includes(me), iDone = done.includes(me);
  let actions = "";
  if ((s === "pending" || s === "awaiting_second_acceptance") && !iAccepted) actions = `<button class="mini-btn" data-offer-respond="${esc(o.id)}" data-accept="1">Accept</button><button class="mini-btn danger" data-offer-respond="${esc(o.id)}" data-accept="0">Decline</button>`;
  else if ((s === "pending" || s === "awaiting_second_acceptance") && iAccepted) actions = `<span class="muted">You accepted. Waiting for the other person.</span><button class="mini-btn danger" data-offer-cancel="${esc(o.id)}">Cancel</button>`;
  if ((s === "confirmed" || s === "completion_pending") && !iDone) actions = `<button class="mini-btn" data-offer-pickup="${esc(o.id)}">I completed the handoff</button>${s === "confirmed" && !done.length ? `<button class="mini-btn danger" data-offer-cancel="${esc(o.id)}">Cancel</button>` : ""}`;
  else if (s === "completion_pending" && iDone) actions = `<span class="muted">You confirmed. Waiting for the other person.</span>`;
  if (s === "completed") actions = `<button class="mini-btn" data-rate-offer="${esc(o.id)}">Rate partner</button>`;
  if (s === "declined") { const own = isMine(o.listing_id) ? o.listing_id : isMine(o.match_id) ? o.match_id : null; if (own) actions = `<button class="mini-btn" data-fallback="${esc(own)}">See next steps for my listing</button>`; }
  return `<div class="record"><strong>Exchange offer</strong>${status(s)}<p>Give: ${itemList(o.give_items || o.give)}</p><p>Receive: ${itemList(o.receive_items || o.receive)}</p><p>${esc(o.location)} &middot; ${esc(windowText(o.pickup_start, o.pickup_end))}</p><p class="muted">Accepted by ${acc.length}/2 &middot; Handoff confirmed by ${done.length}/2</p><div class="row-actions">${actions}</div></div>`;
}
function giveawayCard(r) {
  const me = sessionUser.id, owner = r.owner_id === me, done = (r.completed_by || r.confirmed_by || []).map(uid), iDone = done.includes(me), s = r.status;
  let actions = "";
  if (s === "pending" && owner) actions = `<button class="mini-btn" data-gr-decide="${esc(r.id)}" data-accept="1">Approve</button><button class="mini-btn danger" data-gr-decide="${esc(r.id)}" data-accept="0">Decline</button>`;
  if (s === "pending" && !owner) actions = `<span class="muted">Waiting for owner approval.</span><button class="mini-btn danger" data-gr-cancel="${esc(r.id)}">Cancel</button>`;
  if ((s === "approved" || s === "completion_pending") && !iDone) actions = `<button class="mini-btn" data-gr-pickup="${esc(r.id)}">I completed the handoff</button>${s === "approved" && !done.length ? `<button class="mini-btn danger" data-gr-cancel="${esc(r.id)}">Cancel</button>` : ""}`;
  else if (s === "completion_pending" && iDone) actions = `<span class="muted">You confirmed. Waiting for the other person.</span>`;
  if (s === "completed") actions = `<button class="mini-btn" data-rate-gr="${esc(r.id)}" data-to="${esc(owner ? r.requester_id : r.owner_id)}">Rate ${owner ? "recipient" : "giver"}</button>`;
  if (s === "declined" && owner && r.listing_id) actions = `<button class="mini-btn" data-fallback="${esc(r.listing_id)}">Next steps for my listing</button>`;
  return `<div class="record"><strong>Giveaway ${owner ? "you are giving" : "you requested"}</strong>${status(s)}<p>${itemList(r.item_details)}</p><p>${esc(r.location)} &middot; ${esc(windowText(r.pickup_start, r.pickup_end))}</p><div class="row-actions">${actions}</div></div>`;
}
async function act(fn, okMsg) { try { const r = await fn(); if (okMsg) showToast(okMsg); return r; } catch (e) { showToast(e.message); if (e.status === 409) await load(); } finally { await refreshActivity(); refreshImpact(); } }
async function rate(body) { const stars = Number(prompt("Rate from 1 to 5 stars")); if (!Number.isInteger(stars) || stars < 1 || stars > 5) return; try { await post("/ratings", {...body, stars}); showToast("Rating saved."); } catch (e) { showToast(e.message); } }
document.addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b || !b.closest("#my-handoffs,#my-listings,#notifications-list")) return;
  const d = b.dataset; b.disabled = true;
  try {
    if (d.fallback) await openFallback(d.fallback);
    else if (d.withdraw) { if (confirm("Withdraw this open listing?")) await act(() => api(`/listings/${encodeURIComponent(d.withdraw)}`, {method:"DELETE"}), "Listing withdrawn."); await load(); }
    else if (d.offerRespond) { const r = await act(() => post(`/offers/${encodeURIComponent(d.offerRespond)}/respond`, {accept:d.accept === "1"}), d.accept === "1" ? "Your acceptance was recorded." : "Offer declined."); if (r && d.accept === "0") { const o = r.offer || myOffers.find(x => x.id === d.offerRespond); const own = o && (isMine(o.listing_id) ? o.listing_id : isMine(o.match_id) ? o.match_id : null); if (own) openFallback(own); } }
    else if (d.offerCancel) { if (confirm("Cancel this offer?")) await act(() => post(`/offers/${encodeURIComponent(d.offerCancel)}/cancel`), "Offer cancelled."); }
    else if (d.offerPickup) { if (confirm("Confirm you personally completed this handoff?")) await act(() => post(`/offers/${encodeURIComponent(d.offerPickup)}/confirm-pickup`), "Your handoff confirmation was recorded."); }
    else if (d.rateOffer) { const o = myOffers.find(x => x.id === d.rateOffer); const other = [...(o?.participants || []).map(uid), o?.owner_id, o?.match_owner_id, o?.user_id, o?.match_user_id].find(x => x && x !== sessionUser.id); if (other) await rate({offer_id:d.rateOffer, to_user_id:other}); else showToast("Could not identify your exchange partner."); }
    else if (d.grDecide) await act(() => post(`/giveaway-requests/${encodeURIComponent(d.grDecide)}/decision`, {accept:d.accept === "1"}), d.accept === "1" ? "Request approved." : "Request declined.");
    else if (d.grPickup) { if (confirm("Confirm you personally completed this handoff?")) await act(() => post(`/giveaway-requests/${encodeURIComponent(d.grPickup)}/pickup`), "Your handoff confirmation was recorded."); }
    else if (d.grCancel) { if (confirm("Cancel this giveaway request?")) await act(() => post(`/giveaway-requests/${encodeURIComponent(d.grCancel)}/cancel`), "Request cancelled."); }
    else if (d.rateGr) await rate({request_id:d.rateGr, to_user_id:d.to});
  } finally { b.disabled = false; }
});
$("#refresh-activity").onclick = () => sessionUser ? load() : openAuth();

/* Fallback + matches */
async function openFallback(id) {
  offerArea.hidden = false; offerArea.innerHTML = `<p class="muted">Checking matches and options...</p>`; offerArea.scrollIntoView({behavior:"smooth", block:"center"});
  let fb; try { fb = await api(`/listings/${encodeURIComponent(id)}/fallback-options`); } catch (e) { offerArea.innerHTML = `<h3>Could not load next steps</h3><p>${esc(e.message)}</p><button class="mini-btn" id="fb-retry">Retry</button>`; $("#fb-retry").onclick = () => openFallback(id); return; }
  const matches = fb.matches || [], opts = fb.options || [], isInedible = fb.inedible_confirmed === true || myListings.some(l => l.id === id && l.inedible_confirmed === true);
  offerArea.innerHTML = `<h3>Next steps for your listing</h3>${fb.message ? `<p>${esc(fb.message)}</p>` : ""}
  ${matches.length ? `<h4 class="sub-head">Compatible matches</h4>` + matches.map((m, i) => `<div class="option"><p>You give ${itemList(m.give_items || m.give)}; you receive ${itemList(m.receive_items || m.receive)}.</p><p>${esc(m.location)} &middot; ${esc(windowText(m.pickup_start, m.pickup_end))}</p>${m.reason ? `<p class="muted">${esc(m.reason)}</p>` : ""}<button class="mini-btn" data-propose="${i}">Propose this fixed offer</button></div>`).join("") : `<p>No compatible exchange match right now.</p>`}
  ${fb.can_switch_to_giveaway ? `<div class="option"><p>You can switch this listing to a giveaway. Only you decide.</p><button class="mini-btn" id="fb-giveaway">Switch to giveaway</button></div>` : ""}
  <h4 class="sub-head">Donation and compost options</h4><p class="muted">Manually researched directory, not live acceptance. Confirm current rules with the destination before going.</p>
  ${opts.length ? opts.map(o => `<div class="option"><strong>${esc(o.name)}</strong> <span class="status">${esc(o.type)}</span><p>${esc(o.location)} &middot; Hours: ${esc(o.hours || "not published")}</p><p>Accepts: ${esc((o.accepted_categories || []).join(", ") || "see website")}${o.exclusions?.length ? ` &middot; Excludes: ${esc(o.exclusions.join(", "))}` : ""}</p>${o.notice ? `<p class="muted">${esc(o.notice)}</p>` : ""}<p class="muted">Checked ${esc(o.checked_at || "unknown")} ${o.url ? `&middot; <a href="${esc(o.url)}" target="_blank" rel="noopener">Confirm current rules</a>` : ""}</p>${o.type === "compost" && !isInedible ? `<p class="muted">Composting is only for food that is no longer edible. Confirm below first.</p>` : `<label class="check"><input type="checkbox" data-feasible="${esc(o.id)}"><span>${o.type === "compost" ? "These are accepted fruit/vegetable scraps, and I confirmed acceptance and can reach this San Jose destination during its published hours." : "These unopened packages contain no glass, and I confirmed acceptance and can reach this San Jose destination during its published hours."}</span></label><label class="check"><input type="checkbox" data-drop="${esc(o.id)}"><span>I actually dropped this food off at ${esc(o.name)}.</span></label><button class="mini-btn" data-outcome="${esc(o.id)}" data-type="${esc(o.type)}">Record ${o.type === "compost" ? "compost" : "donation"} drop-off</button>`}</div>`).join("") : `<p>No verified destination is listed for these items or this area.</p>`}
  ${!isInedible ? `<div class="option"><label class="check"><input type="checkbox" id="inedible-check"><span>This food is no longer edible. I understand this withdraws it from edible offers. A passed deadline alone does not mean it is spoiled.</span></label><button class="mini-btn danger" id="inedible-btn">Confirm not edible</button></div>` : ""}
  <p class="muted">Recommendations are not recorded as outcomes. Nothing is donated automatically.</p><button class="mini-btn" id="fb-close">Close</button>`;
  offerArea.querySelectorAll("[data-propose]").forEach(btn => btn.onclick = async () => { const m = matches[btn.dataset.propose]; btn.disabled = true; const r = await act(() => post("/offers", {listing_id:id, match_id:m.listing?.id || m.match_id}), "Offer sent. Both of you must accept."); btn.disabled = false; if (r) offerArea.hidden = true; else openFallback(id); });
  const sw = $("#fb-giveaway"); if (sw) sw.onclick = async () => { if (!confirm("Switch this listing to a giveaway?")) return; if (await act(() => api(`/listings/${encodeURIComponent(id)}`, {method:"PATCH", body:JSON.stringify({mode:"giveaway"})}), "Listing switched to giveaway.")) { await load(); openFallback(id); } };
  const ib = $("#inedible-btn"); if (ib) ib.onclick = async () => { if (!$("#inedible-check").checked) return showToast("Tick the confirmation first."); if (await act(() => api(`/listings/${encodeURIComponent(id)}`, {method:"PATCH", body:JSON.stringify({inedible_confirmed:true})}), "Marked as not edible.")) { await load(); openFallback(id); } };
  offerArea.querySelectorAll("[data-outcome]").forEach(btn => btn.onclick = async () => { const cb = offerArea.querySelector(`[data-drop="${CSS.escape(btn.dataset.outcome)}"]`); const fz = offerArea.querySelector(`[data-feasible="${CSS.escape(btn.dataset.outcome)}"]`); if (!fz.checked) return showToast("Confirm acceptance and that you can reach this destination."); if (!cb.checked) return showToast("Confirm you actually dropped it off."); const compost = btn.dataset.type === "compost"; const body = {listing_id:id, destination_id:btn.dataset.outcome, action:compost ? "compost" : "donation", confirmed:true, destination_feasible_confirmed:true}; if (!compost) body.no_glass_confirmed = true; if (compost) Object.assign(body, {inedible_confirmed:true, material:"fruit_vegetable_scraps"}); if (await act(() => post("/outcomes", body), "Drop-off recorded as user-reported.")) { offerArea.hidden = true; load(); } });
  $("#fb-close").onclick = () => { offerArea.hidden = true; };
}

/* Giveaway request */
let giveawayTarget = null;
function openGiveawayDialog(id) {
  const l = listings.find(x => x.id === id); giveawayTarget = id; const f = $("#giveaway-form"); f.reset(); $("#gd-notice").hidden = true;
  $("#gd-summary").innerHTML = l ? `${itemList(itemsOf(l))}. Owner is available at ${esc(l.location)}, ${esc(windowText(l.pickup_start, l.pickup_end))}. Choose a window that overlaps.` : "";
  if (l && ZONES.includes(l.location)) f.location.value = l.location;
  $("#giveaway-dialog").showModal();
}
$("#giveaway-form").addEventListener("submit", async e => {
  e.preventDefault(); const f = e.currentTarget, s = toUtcIso(f.pickup_start.value), en = toUtcIso(f.pickup_end.value), n = $("#gd-notice");
  if (!f.location.value || !s || !en) return setNotice(n, "Choose a zone and an exact pickup window.");
  if (new Date(en) <= new Date(s)) return setNotice(n, "Pickup end must be after the start.");
  try { await post(`/listings/${encodeURIComponent(giveawayTarget)}/requests`, {pickup_start:s, pickup_end:en, location:f.location.value}); $("#giveaway-dialog").close(); showToast("Request sent. The owner decides."); refreshActivity(); }
  catch (er) { setNotice(n, er.message); }
});
document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => b.closest("dialog").close());

/* Listing form */
function itemRow(i = {}) {
  const n = $("#item-rows").children.length + 1, row = document.createElement("fieldset"); row.className = "item-row";
  row.innerHTML = `<legend>Item ${n}</legend><button type="button" class="mini-btn danger remove-item">Remove</button><div class="form-row"><label class="wide">Food name<input data-f="name" required value="${esc(i.name ?? "")}"></label><label>Quantity<input data-f="quantity" type="number" min="0.01" step="any" required value="${esc(i.quantity ?? "")}"></label><label>Unit<input data-f="unit" required placeholder="each, bag, lb" value="${esc(i.unit ?? "")}"></label></div><div class="form-row"><label>Category<select data-f="category" required><option value="">Choose</option><option value="produce">Whole produce</option><option value="shelf_stable">Unopened shelf-stable</option></select></label><label>Unopened?<select data-f="unopened"><option value="">Not applicable</option><option value="true">Yes, unopened</option><option value="false">No</option></select></label></div><div class="form-row"><label>Printed date <span class="optional">(optional)</span><input data-f="printed_date" type="date" value="${esc(/^\d{4}-\d{2}-\d{2}$/.test(i.printed_date || "") ? i.printed_date : "")}"></label><label>Date label<select data-f="date_type"><option value="">None</option><option value="best_by">Best by</option><option value="use_by">Use by</option><option value="sell_by">Sell by</option><option value="expiration">Expiration</option></select></label></div>`;
  row.querySelector("[data-f=category]").value = i.category ?? ""; row.querySelector("[data-f=unopened]").value = i.unopened == null ? "" : String(i.unopened);
  if (i.date_type) { const dt = row.querySelector("[data-f=date_type]"); dt.value = i.date_type; if (dt.value !== i.date_type) dt.value = ""; }
  row.querySelector(".remove-item").onclick = () => { row.remove(); renumber(); };
  $("#item-rows").append(row); renumber();
}
function renumber() { const rows = [...$("#item-rows").children], bundle = $("#listing-type").value === "bundle"; rows.forEach((r, i) => { r.querySelector("legend").textContent = `Item ${i + 1}`; r.querySelector(".remove-item").hidden = rows.length === 1; }); $("#add-item").hidden = !bundle || rows.length >= 5; }
function setMode() { const g = $("#listing-mode").value === "giveaway"; document.querySelectorAll("#listing-form .exchange-only").forEach(n => n.hidden = g); }
$("#listing-mode").onchange = setMode;
$("#listing-type").onchange = () => { if ($("#listing-type").value === "single") [...$("#item-rows").children].slice(1).forEach(r => r.remove()); renumber(); };
$("#add-item").onclick = () => { if ($("#item-rows").children.length < 5) itemRow(); };
function resetListingForm() { form.reset(); $("#item-rows").innerHTML = ""; itemRow(); setMode(); renumber(); }

$("#interpret-button").onclick = async () => {
  const text = $("#interpret-text").value.trim(), st = $("#interpret-notice"), btn = $("#interpret-button");
  if (!sessionUser) return openAuth(); if (!text) { st.textContent = "Describe your surplus first."; return; }
  btn.disabled = true; st.textContent = "Bob is interpreting your description...";
  try {
    const {draft} = await post("/interpret-listing", {text, timezone:TZ});
    ["pickup_start","pickup_end","deadline"].forEach(k => form[k].value = ""); form.fresh.checked = false; form.storage_confirmed.checked = false;
    const items = (draft.item_details || []).slice(0, 5); $("#item-rows").innerHTML = "";
    $("#listing-type").value = items.length > 1 ? "bundle" : "single"; (items.length ? items : [{}]).forEach(itemRow);
    form.location.value = ZONES.includes(draft.location) ? draft.location : "";
    const notes = [...(draft.ambiguities || [])];
    if (draft.location && !ZONES.includes(draft.location)) notes.push(`Location "${draft.location}" is not a public zone; choose one.`);
    if (draft.availability) notes.push(`You said availability: "${draft.availability}". Set exact pickup times.`);
    if (draft.deadline_text) notes.push(`You said deadline: "${draft.deadline_text}". Set the exact date and time.`);
    st.innerHTML = `Draft ready. Review every field, fill blanks, and choose exact dates yourself. Nothing has been saved.${notes.length ? `<div class="ambiguities"><strong>Please resolve:</strong><ul>${notes.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>` : ""}`;
    renumber();
  } catch (e) { st.textContent = `Interpretation failed: ${e.message} Your text is kept; retry or fill the form manually.`; }
  finally { btn.disabled = false; }
};

form.addEventListener("submit", async e => {
  e.preventDefault(); if (!sessionUser) return openAuth(); notice.hidden = true;
  const type = $("#listing-type").value, mode = $("#listing-mode").value;
  const items = [...$("#item-rows").children].map(r => { const g = f => r.querySelector(`[data-f=${f}]`).value.trim(); const u = g("unopened"); return {name:g("name"), quantity:Number(g("quantity")), unit:g("unit"), category:g("category") || null, unopened:u === "" ? null : u === "true", printed_date:g("printed_date") || null, date_type:g("date_type") || null}; });
  const err = m => setNotice(notice, m);
  if (type === "single" && items.length !== 1) return err("A single listing must have exactly one item.");
  if (items.length < 1 || items.length > 5) return err("List between 1 and 5 items.");
  for (const [i, it] of items.entries()) { if (!it.name || !(it.quantity > 0) || !it.unit) return err(`Item ${i + 1} needs a name, positive quantity and unit.`); if (!it.category) return err(`Choose a category for item ${i + 1}.`); if (it.category === "shelf_stable" && it.unopened !== true) return err(`Shelf-stable item ${i + 1} must be unopened.`); if (it.printed_date && !it.date_type) return err(`Choose a date label for item ${i + 1}.`); }
  const wq = Number(form.wanted_quantity.value);
  if (mode === "exchange" && (!form.wanted_food.value.trim() || !(wq > 0) || !form.wanted_unit.value.trim())) return err("Exchanges need one wanted food with quantity and unit.");
  if (!form.location.value) return err("Choose a public pickup zone.");
  const ps = toUtcIso(form.pickup_start.value), pe = toUtcIso(form.pickup_end.value), dl = toUtcIso(form.deadline.value);
  if (!ps || !pe || !dl) return err("Set exact pickup start, end and deadline.");
  if (new Date(pe) <= new Date(ps)) return err("Pickup end must be after the start.");
  if (!form.fresh.checked || !form.storage_confirmed.checked) return err("Confirm food condition and storage.");
  const payload = {mode, listing_type:type, item_details:items, wanted_food:mode === "exchange" ? form.wanted_food.value.trim() : null, wanted_quantity:mode === "exchange" ? wq : null, wanted_unit:mode === "exchange" ? form.wanted_unit.value.trim() : null, location:form.location.value, pickup_start:ps, pickup_end:pe, deadline:dl, timezone:TZ, fresh:true, storage_confirmed:true, allergens:form.allergens.value.trim()};
  const btn = form.querySelector(".submit"); btn.disabled = true;
  try { const d = await post("/listings", payload); const n = (d.matches || []).length;
    setNotice(notice, mode === "giveaway" ? "Giveaway published." : n ? `Listing published. ${n} compatible match${n === 1 ? "" : "es"} found.` : "Listing published. No compatible match yet.", true);
    resetListingForm(); $("#interpret-text").value = ""; $("#interpret-notice").textContent = ""; await load();
    if (mode === "exchange" && d.listing?.id) openFallback(d.listing.id);
  } catch (er) { err(er.message); } finally { btn.disabled = false; }
});

/* Standalone request */
$("#request-form").addEventListener("submit", async e => {
  e.preventDefault(); if (!sessionUser) return openAuth(); const f = e.currentTarget, m = $("#request-notice");
  const q = Number(f.quantity.value), ps = toUtcIso(f.pickup_start.value), pe = toUtcIso(f.pickup_end.value), dl = toUtcIso(f.deadline.value);
  if (!f.item.value.trim() || !(q > 0) || !f.unit.value.trim()) return setNotice(m, "Enter one food with a positive quantity and unit.");
  if (!f.location.value || !ps || !pe || !dl) return setNotice(m, "Choose a zone, pickup window and needed-by time.");
  if (new Date(pe) <= new Date(ps)) return setNotice(m, "Pickup end must be after the start.");
  try { await post("/requests", {items:[f.item.value.trim()], quantity:q, unit:f.unit.value.trim(), location:f.location.value, pickup_start:ps, pickup_end:pe, deadline:dl, timezone:TZ}); setNotice(m, "Request posted.", true); f.reset(); refreshActivity(); }
  catch (er) { setNotice(m, er.message); }
});

/* Notifications */
async function refreshNotifications() {
  try { const {notifications = []} = await api("/notifications"); $("#notification-count").textContent = `${notifications.filter(n => !n.read).length} NEW`;
    $("#notifications-list").innerHTML = notifications.length ? notifications.slice(0, 8).map(n => `<div class="notification-item"><span class="notification-dot" aria-hidden="true"></span><div><strong>${esc(String(n.kind || "").replaceAll("_", " "))}</strong><p>${esc(n.message)}</p>${n.kind === "trade_declined" && isMine(n.entity_id) ? `<button class="mini-btn" data-fallback="${esc(n.entity_id)}">Next steps</button>` : ""}</div></div>`).join("") + `<p class="muted">Act on offers and requests in My handoffs.</p>` : `<p class="muted">No notifications yet.</p>`;
  } catch {}
}

/* Auth */
function setAuthMode(mode) { authMode = mode; const s = mode === "signup"; $("#auth-title").textContent = s ? "Join EchoPantry" : "Welcome back"; $("#auth-subtitle").textContent = s ? "Create an account to share and find food." : "Sign in to list food and manage your exchanges."; $("#display-name-field").hidden = !s; $("#auth-form [name=display_name]").required = s; $("#auth-form [name=password]").autocomplete = s ? "new-password" : "current-password"; $("#auth-submit").textContent = s ? "Create account" : "Sign in"; $("#login-tab").classList.toggle("selected", !s); $("#signup-tab").classList.toggle("selected", s); }
function clearScoped() { myListings = []; myOffers = []; myRequests = []; offerArea.hidden = true; offerArea.innerHTML = ""; inedible.clear(); $("#notifications-list").innerHTML = `<p class="muted">No notifications yet.</p>`; $("#notification-count").textContent = "0 NEW"; }
function renderSession() { const name = sessionUser?.display_name || "Guest"; $("#profile-name").textContent = name; $("#profile-avatar").textContent = name.charAt(0).toUpperCase(); $("#auth-button").hidden = !!sessionUser; $("#logout-button").hidden = !sessionUser; $("#delete-account").hidden = !sessionUser; $("#listing-auth-help").hidden = !!sessionUser; $("#request-auth-help").hidden = !!sessionUser; if (!sessionUser) clearScoped(); renderActivity(); renderListings(); }
function openAuth(mode = "login") { setAuthMode(mode); $("#auth-notice").hidden = true; $("#auth-dialog").showModal(); }
$("#auth-button").onclick = () => openAuth(); $("#listing-auth-button").onclick = () => openAuth(); $("#request-auth-button").onclick = () => openAuth(); $("#close-auth").onclick = () => $("#auth-dialog").close(); $("#login-tab").onclick = () => setAuthMode("login"); $("#signup-tab").onclick = () => setAuthMode("signup");
$("#auth-form").addEventListener("submit", async e => {
  e.preventDefault(); const f = e.currentTarget, v = new FormData(f), s = authMode === "signup", m = $("#auth-notice"), b = $("#auth-submit"); m.hidden = true; b.disabled = true;
  try { const r = await post(`/auth/${s ? "signup" : "login"}`, s ? {display_name:v.get("display_name"), email:v.get("email"), password:v.get("password")} : {email:v.get("email"), password:v.get("password")});
    if (r.email_confirmation_required) return setNotice(m, "Check your email to confirm your account, then sign in.", true);
    sessionUser = r.user; $("#auth-dialog").close(); f.reset(); renderSession(); await load(); showToast(s ? "Welcome to EchoPantry." : "You are signed in.");
  } catch (er) { setNotice(m, er.message); } finally { b.disabled = false; }
});
$("#logout-button").onclick = async () => { try { await post("/auth/logout"); } catch {} sessionUser = null; renderSession(); await load(); showToast("Signed out."); };
$("#delete-account").onclick = async () => { if (!confirm("Delete your account? This deactivates sign-in and hides your active listings.")) return; try { await api("/auth/account", {method:"DELETE"}); sessionUser = null; renderSession(); await load(); showToast("Account deactivated."); } catch (e) { showToast(e.message); } };

async function initialize() {
  resetListingForm(); renderSession(); checkHealth();
  try { sessionUser = (await api("/auth/me")).user || null; } catch { sessionUser = null; }
  renderSession(); await load();
}
initialize();
setInterval(() => { if (!document.hidden) load(); }, 15000);
