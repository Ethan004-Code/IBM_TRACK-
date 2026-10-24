const $ = selector => document.querySelector(selector);

const state = {
  configured: false,
  map: null,
  tileLayer: null,
  originMarker: null,
  markers: new Map(),
  results: [],
  origin: null,
  selectedId: null,
  toastTimer: null,
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function setProviderStatus(message, kind = "") {
  const status = $("#provider-status");
  status.textContent = message;
  status.className = `provider-status${kind ? ` ${kind}` : ""}`;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
}

function markerIcon(label) {
  return L.divIcon({
    className: "",
    html: `<div class="marker-pin"><span>${escapeHtml(label)}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 31],
    popupAnchor: [0, -28],
  });
}

function initMap() {
  if (state.map || typeof window.L === "undefined") {
    if (typeof window.L === "undefined") $("#map-status").textContent = "Map library unavailable. The verified cards remain usable.";
    return;
  }
  state.map = L.map("donation-map", {scrollWheelZoom: false}).setView([37.335, -121.89], 10);
  state.tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
  });
  state.tileLayer.on("tileerror", () => {
    $("#map-status").textContent = "Map tiles could not load. Destination cards and official links still work.";
  });
  state.tileLayer.addTo(state.map);
}

function clearMapResults() {
  if (!state.map) return;
  state.markers.forEach(marker => marker.remove());
  state.markers.clear();
  if (state.originMarker) state.originMarker.remove();
  state.originMarker = null;
}

function directionsUrl(place) {
  if (!state.origin) return `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=16/${place.latitude}/${place.longitude}`;
  const route = `${state.origin.latitude},${state.origin.longitude};${place.latitude},${place.longitude}`;
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${encodeURIComponent(route)}`;
}

function resultCard(place) {
  const isSelected = state.selectedId === place.id;
  const hasLiveRoute = Number.isFinite(place.drive_minutes) && Number.isFinite(place.drive_miles);
  const confirmationClass = place.item_rules_status === "confirm" ? " confirm" : "";
  const badge = place.item_rules_status === "confirm" ? "✓ Food donations verified · confirm item rules" : "✓ Verified for these items";
  const distance = hasLiveRoute ? `${escapeHtml(place.drive_minutes)} min · ${escapeHtml(place.drive_miles)} mi` : "Live drive time unavailable";
  const mapAction = hasLiveRoute ? "Open directions ↗" : "View location ↗";
  const routeEvidence = hasLiveRoute ? " · Live route from openrouteservice" : " · No route time estimated";
  return `<article class="location-card${isSelected ? " selected" : ""}" data-place="${escapeHtml(place.id)}" tabindex="0">
    <div class="location-card-head"><h3>${escapeHtml(place.name)}</h3><span class="distance">${distance}</span></div>
    <span class="verified${confirmationClass}">${badge}</span>
    <p>${escapeHtml(place.policy)}</p>
    <p><strong>${escapeHtml(place.hours)}</strong><br>${escapeHtml(place.address)}</p>
    <div class="card-actions">
      <button class="text-link" type="button" data-focus="${escapeHtml(place.id)}">Show on map</button>
      <a class="text-link" href="${escapeHtml(place.source_url)}" target="_blank" rel="noreferrer">Official source ↗</a>
      <a class="text-link" href="${escapeHtml(directionsUrl(place))}" target="_blank" rel="noreferrer">${mapAction}</a>
    </div>
    <p class="fineprint">Official acceptance source checked ${escapeHtml(place.verified_at)}${routeEvidence}</p>
  </article>`;
}

function selectResult(id, openPopup = true) {
  const place = state.results.find(result => result.id === id);
  if (!place) return;
  state.selectedId = id;
  document.querySelectorAll(".location-card").forEach(card => card.classList.toggle("selected", card.dataset.place === id));
  if (state.map && state.markers.has(id)) {
    state.map.flyTo([place.latitude, place.longitude], 13, {duration: 0.45});
    if (openPopup) state.markers.get(id).openPopup();
  }
}

function bindCards() {
  document.querySelectorAll(".location-card").forEach(card => {
    card.addEventListener("click", event => {
      if (!event.target.closest("a")) selectResult(card.dataset.place);
    });
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectResult(card.dataset.place);
      }
    });
  });
  document.querySelectorAll("[data-focus]").forEach(button => button.addEventListener("click", event => {
    event.stopPropagation();
    selectResult(button.dataset.focus);
  }));
}

function renderResults(payload) {
  state.results = payload.destinations || [];
  state.origin = payload.origin || null;
  const hasLiveRoutes = Boolean(state.origin) && state.results.every(place => Number.isFinite(place.drive_minutes));
  state.selectedId = state.results[0]?.id || null;
  clearMapResults();
  const list = $("#location-list");
  if (!state.results.length) {
    list.innerHTML = `<div class="empty-state"><strong>No verified donation destination was found within ${escapeHtml(payload.max_drive_minutes)} minutes.</strong><br>Try a wider drive time. RePlate will not substitute unverified OpenStreetMap places.</div>`;
    $("#results-summary").textContent = `No verified results near ${payload.origin?.label || "that area"}.`;
    if (state.map && state.origin) state.map.setView([state.origin.latitude, state.origin.longitude], 10);
    return;
  }
  list.innerHTML = state.results.map(resultCard).join("");
  $("#results-summary").textContent = hasLiveRoutes
    ? `${state.results.length} verified option${state.results.length === 1 ? "" : "s"} within ${payload.max_drive_minutes} minutes of ${payload.origin.label}, ranked by live drive time.`
    : `${state.results.length} verified destinations are ready. Add the routing key to rank them by live drive time.`;
  bindCards();
  if (!state.map) return;
  const bounds = [];
  if (state.origin) {
    state.originMarker = L.circleMarker([state.origin.latitude, state.origin.longitude], {radius: 7, color: "#365f46", weight: 3, fillColor: "#ffffff", fillOpacity: 1})
      .addTo(state.map).bindPopup(`<b>Search area</b><br>${escapeHtml(state.origin.label)}`);
    bounds.push([state.origin.latitude, state.origin.longitude]);
  }
  state.results.forEach((place, index) => {
    const routeSummary = Number.isFinite(place.drive_minutes) ? `${escapeHtml(place.drive_minutes)} min · ${escapeHtml(place.drive_miles)} mi<br>` : "";
    const marker = L.marker([place.latitude, place.longitude], {icon: markerIcon(String(index + 1))})
      .addTo(state.map)
      .bindPopup(`<b>${escapeHtml(place.name)}</b><br>${routeSummary}<small>${escapeHtml(place.policy)}</small>`);
    marker.on("click", () => selectResult(place.id, false));
    state.markers.set(place.id, marker);
    bounds.push([place.latitude, place.longitude]);
  });
  state.map.fitBounds(bounds, {padding: [35, 35], maxZoom: 12});
  $("#map-status").textContent = hasLiveRoutes
    ? "Live route estimates · Map data © OpenStreetMap contributors"
    : "Verified destination locations · Map data © OpenStreetMap contributors";
}

async function searchRoutes() {
  const area = $("#area-input").value.trim();
  const maxDriveMinutes = Number($("#drive-limit").value);
  const button = $("#search-routes");
  if (!area) return;
  if (!state.configured) {
    setProviderStatus("Live routing is not configured. Restart the preview with OPENROUTESERVICE_API_KEY set.", "warning");
    return;
  }
  button.disabled = true;
  button.textContent = "Calculating…";
  $("#results-summary").textContent = `Calculating routes near ${area}…`;
  try {
    const response = await fetch("/api/search", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({area, max_drive_minutes: maxDriveMinutes})});
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Live routing could not complete.");
    setProviderStatus("Live geocoding and driving-time ranking are active.");
    renderResults(payload);
  } catch (error) {
    setProviderStatus(error.message, "error");
    $("#results-summary").textContent = "The route search failed. Your listing and the rest of this prototype were not changed.";
  } finally {
    button.disabled = false;
    button.textContent = "Search nearby";
  }
}

async function checkProvider() {
  try {
    const response = await fetch("/api/status", {headers: {"Accept": "application/json"}});
    const payload = await response.json();
    state.configured = Boolean(payload.routing_configured);
    if (payload.destinations?.length) renderResults({destinations: payload.destinations});
    if (state.configured) {
      setProviderStatus("Live routing is configured. Search for a ZIP code or neighborhood.");
      return true;
    }
    setProviderStatus("Live routing needs OPENROUTESERVICE_API_KEY. The key stays in the local server environment and is never sent to this page.", "warning");
  } catch {
    setProviderStatus("The local routing proxy is unavailable. Start preview_server.py instead of a static file server.", "error");
  }
  return false;
}

$("#show-options").addEventListener("click", async () => {
  const content = $("#fallback-content");
  const opening = content.hidden;
  content.hidden = !opening;
  $("#show-options").setAttribute("aria-expanded", String(opening));
  $("#show-options").innerHTML = opening ? "Hide donation options" : "Find donation options <span aria-hidden=\"true\">→</span>";
  if (!opening) return;
  initMap();
  setTimeout(() => state.map?.invalidateSize(), 50);
  const configured = await checkProvider();
  if (configured) await searchRoutes();
});

$("#route-search").addEventListener("submit", event => {event.preventDefault(); searchRoutes();});
$("#drive-limit").addEventListener("change", () => {
  if (!$("#fallback-content").hidden && $("#area-input").value.trim()) searchRoutes();
});
$("#retry-match").addEventListener("click", () => {
  const button = $("#retry-match");
  button.disabled = true;
  button.textContent = "Searching…";
  setTimeout(() => {
    button.disabled = false;
    button.textContent = "Search again";
    $("#match-status").textContent = "No new exchange yet. Your listing is still active; donation options remain available below.";
    showToast("No new exchange match yet.");
  }, 650);
});
