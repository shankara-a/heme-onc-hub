/* funding.js — Funding (non-NIH) tab: society & foundation awards for heme/onc fellows.
   Sorted by next upcoming deadline, filterable by category. Exposes HK.renderFunding(data). */
window.HK = window.HK || {};

(function () {
  const MS_DAY = 86400000;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let fundData = null;
  let filter = "all";

  function parseDate(s) {
    if (!s) return null;
    const [y, m, d] = s.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }
  function fmt(d) {
    return d ? `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : "";
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function analyze(opp, today) {
    const deadlines = (opp.deadlines || []).map((d) => ({ ...d, dateObj: parseDate(d.date) }));
    const upcoming = deadlines
      .filter((d) => d.dateObj && d.dateObj >= today)
      .sort((a, b) => a.dateObj - b.dateObj);
    const hasTBA = deadlines.some((d) => !d.dateObj);
    let group, sortValue, next = upcoming[0] || null;
    if (next) { group = 0; sortValue = next.dateObj.getTime(); }
    else if (hasTBA) { group = 1; sortValue = 0; }
    else { group = 2; sortValue = 0; }
    return { deadlines, next, group, sortValue };
  }

  function countdown(info) {
    if (info.group === 0) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const days = Math.ceil((info.next.dateObj - today) / MS_DAY);
      return {
        cls: days <= 30 ? "urgent" : "",
        txt: days === 0 ? "Due today" : `${days} day${days === 1 ? "" : "s"} left`,
        sub: info.next.label,
      };
    }
    if (info.group === 1) return { cls: "", txt: "Cycle / dates vary", sub: "see official page" };
    return { cls: "closed", txt: "Cycle closed", sub: "awaiting next cycle" };
  }

  function card(opp, info) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cd = countdown(info);
    const cardCls = info.group === 2 ? "closed" : (cd.cls === "urgent" ? "urgent" : "");

    const dlItems = info.deadlines.map((d) => {
      let dateCls = "dl-date", dateTxt;
      if (!d.dateObj) { dateCls += " tba"; dateTxt = "TBA"; }
      else if (d.dateObj < today) { dateCls += " past"; dateTxt = fmt(d.dateObj); }
      else { dateTxt = fmt(d.dateObj); }
      const time = d.time ? ` <span class="muted">(${esc(d.time)})</span>` : "";
      const note = d.note ? `<div class="dl-note">${esc(d.note)}</div>` : "";
      return `<li><span class="${dateCls}">${dateTxt}</span>` +
             `<span class="dl-label">${esc(d.label)}${time}</span>${note}</li>`;
    }).join("");

    const chips = [
      opp.category ? `<span class="conf-focus cat-${esc(opp.category).replace(/[^a-z]/gi, "")}">${esc(opp.category)}</span>` : "",
      opp.focus ? `<span class="conf-focus">${esc(opp.focus)}</span>` : "",
      opp.stage ? `<span class="conf-focus">${esc(opp.stage)}</span>` : "",
    ].join(" ");

    return `<div class="conf-card fund-card ${cardCls}">
      <div class="conf-head">
        <div>
          <h3 class="conf-name"><a href="${esc(opp.url)}" target="_blank" rel="noopener">${esc(opp.name)}</a></h3>
          <p class="conf-full">${esc(opp.org || "")}</p>
        </div>
        <div class="countdown ${cd.cls}">
          <div>${cd.txt}</div>
          <div class="muted" style="font-weight:400">${esc(cd.sub)}</div>
        </div>
      </div>
      <p class="fund-amount"><strong>${esc(opp.amount || "")}</strong>${opp.duration ? ` · ${esc(opp.duration)}` : ""}</p>
      <div class="fund-chips">${chips}</div>
      ${opp.eligibility ? `<p class="fund-elig">${esc(opp.eligibility)}</p>` : ""}
      <ul class="deadline-list">${dlItems}</ul>
      ${opp.typical_timing ? `<p class="typical">Typical timing: ${esc(opp.typical_timing)}</p>` : ""}
    </div>`;
  }

  function render() {
    const list = document.getElementById("funding-list");
    if (!list || !fundData) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const verified = document.getElementById("funding-verified");
    if (verified && fundData.last_verified) {
      verified.textContent = `Last verified ${fundData.last_verified}`;
    }

    const ranked = (fundData.opportunities || [])
      .filter((o) => filter === "all" || o.category === filter)
      .map((o) => ({ opp: o, info: analyze(o, today) }))
      .sort((a, b) => a.info.group - b.info.group || a.info.sortValue - b.info.sortValue);

    list.innerHTML = ranked.length
      ? ranked.map((r) => card(r.opp, r.info)).join("")
      : `<p class="muted">No opportunities in this category.</p>`;
  }

  function wireToggle() {
    const toggle = document.getElementById("funding-toggle");
    if (!toggle || toggle.dataset.wired) return;
    toggle.dataset.wired = "1";
    toggle.addEventListener("click", (e) => {
      const btn = e.target.closest(".seg");
      if (!btn) return;
      filter = btn.dataset.fundFilter;
      toggle.querySelectorAll(".seg").forEach((b) =>
        b.classList.toggle("active", b === btn));
      render();
    });
  }

  HK.renderFunding = function (data) {
    fundData = data;
    wireToggle();
    render();
  };
})();
