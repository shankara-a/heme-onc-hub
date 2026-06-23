/* deadlines.js — unified "Upcoming Deadlines" tab merging conference, funding, and
   standard NIH K receipt dates into one chronological list. Exposes HK.renderDeadlines. */
window.HK = window.HK || {};

(function () {
  const U = () => HK.util;
  let confData = null, fundData = null, view = "90", typeFilter = "all";

  // Standard NIH receipt dates (non-AIDS). month is 1-based.
  const NIH_DATES = [
    { label: "New application", days: [[2, 12], [6, 12], [10, 12]] },
    { label: "Renewal / Resubmission / Revision", days: [[3, 12], [7, 12], [11, 12]] },
  ];
  const NIH_URL = "https://grants.nih.gov/grants/how-to-apply-application-guide/" +
    "due-dates-and-submission-policies/standard-due-dates";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function collect() {
    const today = U().today();
    const items = [];

    (confData?.conferences || []).forEach((c) => {
      const url = c.abstract_url || c.society_url;
      (c.cycles || []).forEach((cy) =>
        (cy.deadlines || []).forEach((d) => {
          const dt = U().parseDate(d.date);
          if (dt && dt >= today) items.push({
            dt, type: "Conference", cls: "conference", name: c.name,
            label: d.label, time: d.time, url, saveId: `conf:${c.name}`,
          });
        }));
    });

    (fundData?.opportunities || []).forEach((o) => {
      (o.deadlines || []).forEach((d) => {
        const dt = U().parseDate(d.date);
        if (dt && dt >= today) items.push({
          dt, type: "Funding", cls: "funding", name: o.name,
          label: d.label, time: d.time, url: o.url, saveId: `fund:${o.name}`,
        });
      });
    });

    const yr = today.getFullYear();
    NIH_DATES.forEach((grp) => {
      [yr, yr + 1, yr + 2].forEach((y) =>
        grp.days.forEach(([m, day]) => {
          const dt = new Date(y, m - 1, day);
          if (dt >= today) items.push({
            dt, type: "NIH K", cls: "nih", name: "NIH K standard receipt",
            label: grp.label, url: NIH_URL, saveId: `nih:${grp.label}|${y}-${m}-${day}`,
          });
        }));
    });

    items.sort((a, b) => a.dt - b.dt);
    return items;
  }

  function row(it) {
    const days = U().daysUntil(it.dt);
    const urg = days <= 14 ? "urgent" : (days <= 30 ? "soon" : "");
    const cal = U().calBtn({
      title: `${it.name} — ${it.label}`, date: `${it.dt.getFullYear()}-${it.dt.getMonth() + 1}-${it.dt.getDate()}`,
      description: it.label, url: it.url,
    });
    return `<div class="dl-row type-${it.cls}">
      <div class="dl-when">
        <span class="dl-days ${urg}">${days === 0 ? "today" : days + "d"}</span>
        <span class="dl-date2">${U().fmtDate(it.dt)}</span>
      </div>
      <div class="dl-main">
        <span class="dl-type ${it.cls}">${esc(it.type)}</span>
        <a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.name)}</a>
        <span class="dl-sub">${esc(it.label)}${it.time ? ` · ${esc(it.time)}` : ""}</span>
      </div>
      <div class="dl-actions">${U().starBtn(it.saveId)}${cal}</div>
    </div>`;
  }

  function render() {
    const list = document.getElementById("dl-list");
    if (!list) return;
    let items = collect();
    const today = U().today();

    if (typeFilter !== "all") items = items.filter((it) => it.cls === typeFilter);

    if (view === "saved") {
      const saved = HK.store.list();
      items = items.filter((it) => saved.has(it.saveId));
    } else {
      const horizon = new Date(today);
      horizon.setDate(today.getDate() + (view === "365" ? 365 : 90));
      items = items.filter((it) => it.dt <= horizon);
    }

    const count = document.getElementById("dl-count");
    if (count) count.textContent =
      `${items.length} deadline${items.length === 1 ? "" : "s"}` +
      (view === "saved" ? " saved" : ` in the next ${view === "365" ? "year" : "90 days"}`);

    list.innerHTML = items.length
      ? items.map(row).join("")
      : `<p class="muted" style="padding:8px">${view === "saved"
          ? "No saved deadlines yet — tap ☆ on any deadline, conference, or funding card to save it here."
          : "Nothing due in this window."}</p>`;
  }

  function wireToggle(id, apply) {
    const el = document.getElementById(id);
    if (!el || el.dataset.wired) return;
    el.dataset.wired = "1";
    el.addEventListener("click", (e) => {
      const btn = e.target.closest(".seg");
      if (!btn) return;
      apply(btn);
      el.querySelectorAll(".seg").forEach((b) => b.classList.toggle("active", b === btn));
      render();
    });
  }

  function wire() {
    wireToggle("dl-toggle", (btn) => { view = btn.dataset.dlView; });
    wireToggle("dl-type-toggle", (btn) => { typeFilter = btn.dataset.dlType; });

    // keep the list in sync when a star is toggled anywhere
    if (!HK._dlStarWired) {
      HK._dlStarWired = true;
      document.addEventListener("hk:saved", () => {
        if (document.getElementById("overview")?.classList.contains("active")) render();
        else HK._dlDirty = true;
      });
    }
  }

  HK.renderDeadlines = function (conf, fund) {
    confData = conf; fundData = fund;
    wire();
    render();
  };
})();
