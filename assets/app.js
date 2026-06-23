/* app.js — bootstrap: load data, route tabs, render overview, lazy-init each tab. */
window.HK = window.HK || {};

(function () {
  const state = { grants: null, meta: null, conf: null, fund: null, inited: {} };

  const $ = (id) => document.getElementById(id);

  function money(n) {
    if (!n) return "$0";
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return "$" + Math.round(n / 1e3) + "K";
    return "$" + n;
  }

  /* ---------- tab routing ---------- */
  function showTab(name) {
    document.querySelectorAll(".tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.tab === name));
    document.querySelectorAll(".panel").forEach((p) =>
      p.classList.toggle("active", p.id === name));
    ensureTab(name);
    if (name === "map" && HK.refreshMap) HK.refreshMap();
    if (name === "overview" && HK._dlDirty) { HK.renderDeadlines(state.conf, state.fund); HK._dlDirty = false; }
    if (history.replaceState) history.replaceState(null, "", "#" + name);
  }

  function ensureTab(name) {
    if (state.inited[name]) return;
    switch (name) {
      case "overview":
        if (state.meta) HK.renderCharts(state.meta);
        HK.renderDeadlines(state.conf, state.fund);
        state.inited.overview = true;
        break;
      case "grants":
        if (state.grants) { HK.initGrants(state.grants); state.inited.grants = true; }
        break;
      case "map":
        if (state.meta) { HK.renderMap(state.meta); state.inited.map = true; }
        break;
      case "conferences":
        if (state.conf) { HK.renderConferences(state.conf); state.inited.conferences = true; }
        break;
      case "funding":
        if (state.fund) { HK.renderFunding(state.fund); state.inited.funding = true; }
        break;
    }
  }

  /* ---------- overview stats ---------- */
  function renderOverview() {
    const grid = $("stat-grid");
    if (!state.meta) {
      grid.innerHTML =
        `<div class="error-box">Grant data not loaded yet. Run
         <code>python scripts/fetch_grants.py</code> to generate
         <code>data/grants.json</code>, then reload. (The Conference Deadlines and
         Fellow's Playbook tabs work without it.)</div>`;
      $("updated-badge").textContent = "Grant data not loaded";
      return;
    }
    const m = state.meta;
    const states = Object.keys(m.by_state || {}).length;
    grid.innerHTML = [
      ["Active K-awards", m.total_awards, ""],
      ["New since last refresh", m.new_count, "ok"],
      ["Annual funding", money(m.total_funding), "accent"],
      ["States represented", states, "accent"],
    ].map(([label, val, cls]) =>
      `<div class="stat ${cls}"><div class="num">${val}</div><div class="label">${label}</div></div>`
    ).join("");

    $("updated-badge").textContent =
      `Updated ${m.updated_at} · ${m.total_awards} awards`;
  }

  /* ---------- data loading ---------- */
  async function loadJSON(path) {
    const r = await fetch(path, { cache: "no-store" });
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.json();
  }

  async function boot() {
    const [grants, meta, conf, fund] = await Promise.allSettled([
      loadJSON("data/grants.json"),
      loadJSON("data/grants_meta.json"),
      loadJSON("data/conferences.json"),
      loadJSON("data/funding.json"),
    ]);

    state.grants = grants.status === "fulfilled" ? grants.value : null;
    state.meta = meta.status === "fulfilled" ? meta.value : null;
    state.conf = conf.status === "fulfilled" ? conf.value : null;
    state.fund = fund.status === "fulfilled" ? fund.value : null;

    renderOverview();

    // Render whichever tab is currently active, then mark others for lazy init.
    const active = document.querySelector(".tab.active");
    ensureTab(active ? active.dataset.tab : "overview");

    if (!state.conf) {
      $("conf-list").innerHTML =
        `<div class="error-box">Could not load conference data
         (data/conferences.json). If you opened the file directly, serve it over HTTP
         instead: <code>python -m http.server</code>.</div>`;
    }
    if (!state.fund) {
      $("funding-list").innerHTML =
        `<div class="error-box">Could not load funding data (data/funding.json).
         Serve over HTTP: <code>python -m http.server</code>.</div>`;
    }
    if (!state.grants) {
      $("grant-body").innerHTML =
        `<tr><td colspan="9" class="loading">Grant data not available yet —
         run <code>python scripts/fetch_grants.py</code>.</td></tr>`;
    }
  }

  /* ---------- wiring ---------- */
  document.addEventListener("DOMContentLoaded", () => {
    $("tabs").addEventListener("click", (e) => {
      const tab = e.target.closest(".tab");
      if (tab) showTab(tab.dataset.tab);
    });

    // In-page "jump to tab" links (e.g., from the Playbook).
    document.body.addEventListener("click", (e) => {
      const jump = e.target.closest("[data-jump]");
      if (jump) { e.preventDefault(); showTab(jump.dataset.jump); }
    });

    const hash = (location.hash || "").replace("#", "");
    if (hash && document.getElementById(hash)) showTab(hash);

    boot();
  });
})();
