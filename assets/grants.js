/* grants.js — Grant Library table: filter, sort, search, localStorage shortlist.
   Exposes HK.initGrants(grants). */
window.HK = window.HK || {};

(function () {
  const SHORTLIST_KEY = "hkhub.shortlist";
  let all = [];
  let sortKey = "fiscal_year";
  let sortDir = -1;

  const shortlist = new Set(
    JSON.parse(localStorage.getItem(SHORTLIST_KEY) || "[]")
  );

  const $ = (id) => document.getElementById(id);

  function saveShortlist() {
    localStorage.setItem(SHORTLIST_KEY, JSON.stringify([...shortlist]));
  }

  function money(n) {
    if (!n) return "—";
    return "$" + Number(n).toLocaleString("en-US");
  }

  function uniqueSorted(key) {
    return [...new Set(all.map((g) => g[key]).filter(Boolean))].sort();
  }

  function fillSelect(id, values) {
    const sel = $(id);
    if (!sel) return;
    values.forEach((v) => {
      const o = document.createElement("option");
      o.value = v; o.textContent = v; sel.appendChild(o);
    });
  }

  function current() {
    const q = ($("grant-search").value || "").toLowerCase().trim();
    const sub = $("filter-subarea").value;
    const mech = $("filter-mechanism").value;
    const type = $("filter-type").value;
    const onlyStar = $("filter-shortlist").checked;

    let rows = all.filter((g) => {
      if (sub && g.subarea !== sub) return false;
      if (mech && g.mechanism !== mech) return false;
      if (type && g.research_type !== type) return false;
      if (onlyStar && !shortlist.has(g.core_project_num)) return false;
      if (q) {
        const hay = (g.title + " " + g.pi + " " + g.org).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    rows.sort((a, b) => {
      let av, bv;
      if (sortKey === "star") {
        av = shortlist.has(a.core_project_num) ? 1 : 0;
        bv = shortlist.has(b.core_project_num) ? 1 : 0;
      } else {
        av = a[sortKey]; bv = b[sortKey];
      }
      if (typeof av === "string") { av = av.toLowerCase(); bv = (bv || "").toLowerCase(); }
      av = av == null ? "" : av; bv = bv == null ? "" : bv;
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return 0;
    });
    return rows;
  }

  function render() {
    const rows = current();
    const body = $("grant-body");
    body.innerHTML = "";
    const frag = document.createDocumentFragment();

    rows.forEach((g) => {
      const tr = document.createElement("tr");
      const starred = shortlist.has(g.core_project_num);
      const typeClass = g.research_type.startsWith("Patient") ? "type-clin" : "type-lab";
      tr.innerHTML =
        `<td class="star-cell ${starred ? "on" : ""}" data-id="${g.core_project_num}">${starred ? "★" : "☆"}</td>` +
        `<td><a href="${g.url}" target="_blank" rel="noopener">${esc(g.title)}</a></td>` +
        `<td>${esc(g.pi)}</td>` +
        `<td>${esc(g.org)}<div class="muted">${esc([g.city, g.state].filter(Boolean).join(", "))}</div></td>` +
        `<td><span class="subarea-tag">${esc(g.subarea)}</span></td>` +
        `<td class="mech-tag">${esc(g.mechanism)}</td>` +
        `<td class="${typeClass}">${g.research_type.startsWith("Patient") ? "Clinical" : "Lab"}</td>` +
        `<td class="num">${money(g.amount)}</td>` +
        `<td class="num">${g.fiscal_year || "—"}</td>`;
      frag.appendChild(tr);
    });
    body.appendChild(frag);
    $("grant-count").textContent =
      `${rows.length} award${rows.length === 1 ? "" : "s"}` +
      (shortlist.size ? ` · ${shortlist.size} shortlisted` : "");
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function wire() {
    ["grant-search", "filter-subarea", "filter-mechanism", "filter-type", "filter-shortlist"]
      .forEach((id) => {
        const el = $(id);
        el.addEventListener(id === "grant-search" ? "input" : "change", render);
      });

    document.querySelectorAll("#grant-table thead th").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (sortKey === key) sortDir *= -1;
        else { sortKey = key; sortDir = key === "amount" || key === "fiscal_year" ? -1 : 1; }
        render();
      });
    });

    $("grant-body").addEventListener("click", (e) => {
      const cell = e.target.closest(".star-cell");
      if (!cell) return;
      const id = cell.dataset.id;
      if (shortlist.has(id)) shortlist.delete(id);
      else shortlist.add(id);
      saveShortlist();
      render();
    });
  }

  HK.initGrants = function (grants) {
    all = grants || [];
    fillSelect("filter-subarea", uniqueSorted("subarea"));
    fillSelect("filter-mechanism", uniqueSorted("mechanism"));
    fillSelect("filter-type", uniqueSorted("research_type"));
    wire();
    render();
  };
})();
