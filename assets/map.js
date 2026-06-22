/* map.js — Institutions & Map tab. Exposes HK.renderMap(meta) and HK.refreshMap(). */
window.HK = window.HK || {};

(function () {
  let map = null;
  let built = false;

  // Approximate state centroids for sizing award circles.
  const CENTROIDS = {
    AL: [32.8, -86.8], AK: [64.2, -149.5], AZ: [34.3, -111.7], AR: [34.8, -92.4],
    CA: [37.2, -119.4], CO: [39.0, -105.5], CT: [41.6, -72.7], DE: [39.0, -75.5],
    DC: [38.9, -77.0], FL: [28.6, -81.5], GA: [32.6, -83.4], HI: [20.3, -156.4],
    ID: [44.3, -114.6], IL: [40.0, -89.2], IN: [39.9, -86.3], IA: [42.0, -93.5],
    KS: [38.5, -98.4], KY: [37.5, -85.3], LA: [31.0, -92.0], ME: [45.4, -69.2],
    MD: [39.0, -76.7], MA: [42.3, -71.8], MI: [44.3, -85.4], MN: [46.3, -94.3],
    MS: [32.7, -89.7], MO: [38.4, -92.5], MT: [46.9, -110.4], NE: [41.5, -99.8],
    NV: [39.3, -116.6], NH: [43.7, -71.6], NJ: [40.1, -74.7], NM: [34.4, -106.1],
    NY: [42.9, -75.5], NC: [35.5, -79.4], ND: [47.5, -100.5], OH: [40.3, -82.8],
    OK: [35.6, -97.5], OR: [43.9, -120.6], PA: [40.9, -77.8], RI: [41.7, -71.6],
    SC: [33.9, -80.9], SD: [44.4, -100.2], TN: [35.9, -86.4], TX: [31.5, -99.3],
    UT: [39.3, -111.7], VT: [44.1, -72.7], VA: [37.5, -78.9], WA: [47.4, -120.5],
    WV: [38.6, -80.6], WI: [44.6, -89.9], WY: [43.0, -107.5], PR: [18.2, -66.4],
  };

  function buildMap(byState) {
    const el = document.getElementById("leaflet-map");
    if (!el || typeof L === "undefined") return;
    map = L.map("leaflet-map", { scrollWheelZoom: false }).setView([39.5, -98.5], 3.5);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO", maxZoom: 12,
    }).addTo(map);

    Object.entries(byState || {}).forEach(([st, count]) => {
      const c = CENTROIDS[st];
      if (!c) return;
      L.circleMarker(c, {
        radius: 5 + 3 * Math.sqrt(count),
        color: "#b3122b", weight: 1, fillColor: "#b3122b", fillOpacity: 0.45,
      })
        .bindTooltip(`${st}: ${count} award${count === 1 ? "" : "s"}`, { direction: "top" })
        .addTo(map);
    });
    built = true;
  }

  function buildOrgList(topOrgs) {
    const ol = document.getElementById("org-list");
    if (!ol) return;
    ol.innerHTML = "";
    Object.entries(topOrgs || {}).forEach(([org, n]) => {
      const li = document.createElement("li");
      li.innerHTML = `${org} <span class="count">${n}</span>`;
      ol.appendChild(li);
    });
  }

  HK.renderMap = function (meta) {
    if (!meta) return;
    buildOrgList(meta.top_orgs);
    if (!built) buildMap(meta.by_state);
  };

  // Leaflet needs a visible container to size correctly; call when the tab opens.
  HK.refreshMap = function () {
    if (map) setTimeout(() => map.invalidateSize(), 50);
  };
})();
