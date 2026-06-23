/* conferences.js — Conference Deadlines tab. Exposes HK.renderConferences(data). */
window.HK = window.HK || {};

(function () {
  const MS_DAY = 86400000;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function parseDate(s) {
    if (!s) return null;
    const [y, m, d] = s.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d); // local midnight
  }

  function fmt(dateObj) {
    if (!dateObj) return "";
    return `${MONTHS[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}`;
  }

  function meetingLine(cycle) {
    if (!cycle) return "";
    const parts = [];
    const s = parseDate(cycle.meeting_start);
    const e = parseDate(cycle.meeting_end);
    if (s && e) {
      const sameMonth = s.getMonth() === e.getMonth();
      parts.push(sameMonth
        ? `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${e.getFullYear()}`
        : `${fmt(s)} – ${fmt(e)}`);
    }
    if (cycle.location) parts.push(cycle.location);
    return parts.join(" · ");
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function analyze(conf, today) {
    const deadlines = [];
    (conf.cycles || []).forEach((cycle) => {
      (cycle.deadlines || []).forEach((d) => {
        deadlines.push({ ...d, dateObj: parseDate(d.date), cycle });
      });
    });
    const upcoming = deadlines
      .filter((d) => d.dateObj && d.dateObj >= today)
      .sort((a, b) => a.dateObj - b.dateObj);
    const hasTBA = deadlines.some((d) => !d.dateObj && (d.note || "").toLowerCase().indexOf("closed") === -1);

    let group, sortValue, next = upcoming[0] || null;
    const meetingStart = parseDate((conf.cycles[0] || {}).meeting_start);
    if (next) { group = 0; sortValue = next.dateObj.getTime(); }
    else if (hasTBA && (!meetingStart || meetingStart >= today)) {
      group = 1; sortValue = meetingStart ? meetingStart.getTime() : Infinity;
    } else {
      group = 2; sortValue = meetingStart ? -meetingStart.getTime() : 0;
    }
    return { deadlines, next, group, sortValue };
  }

  function countdown(info, today) {
    if (info.group === 0) {
      const days = Math.ceil((info.next.dateObj - today) / MS_DAY);
      const cls = days <= 30 ? "urgent" : "";
      const txt = days === 0 ? "Due today" : `${days} day${days === 1 ? "" : "s"} left`;
      return { cls, txt, sub: info.next.label };
    }
    if (info.group === 1) return { cls: "", txt: "Dates TBA", sub: "see official site" };
    return { cls: "closed", txt: "Cycle closed", sub: "awaiting next year" };
  }

  function card(conf, info, today) {
    const cycle = conf.cycles[0] || {};
    const cd = countdown(info, today);
    const cardCls = info.group === 2 ? "closed" : (cd.cls === "urgent" ? "urgent" : "");

    const dlItems = info.deadlines.map((d) => {
      let dateCls = "dl-date", dateTxt, cal = "";
      if (!d.dateObj) { dateCls += " tba"; dateTxt = "TBA"; }
      else if (d.dateObj < today) { dateCls += " past"; dateTxt = fmt(d.dateObj); }
      else {
        dateTxt = fmt(d.dateObj);
        cal = HK.util.calBtn({ title: `${conf.name} — ${d.label}`, date: d.date,
          description: d.label, url: conf.abstract_url || conf.society_url });
      }
      const time = d.time ? ` <span class="muted">(${esc(d.time)})</span>` : "";
      const note = d.note ? `<div class="dl-note">${esc(d.note)}</div>` : "";
      return `<li><span class="${dateCls}">${dateTxt}</span>` +
             `<span class="dl-label">${esc(d.label)}${time}</span>${cal}${note}</li>`;
    }).join("");

    const guidelines = (cycle.guidelines || []).length
      ? `<ul class="conf-guidelines">${cycle.guidelines.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>`
      : "";

    const typical = conf.typical_timing
      ? `<p class="typical">Typical timing: ${esc(conf.typical_timing)}</p>` : "";

    return `<div class="conf-card ${cardCls}">
      <div class="conf-head">
        <div>
          <h3 class="conf-name"><a href="${esc(conf.abstract_url || conf.society_url)}" target="_blank" rel="noopener">${esc(conf.name)}</a></h3>
          <p class="conf-full">${esc(conf.full_name || "")}</p>
          <p class="conf-meta">${esc(meetingLine(cycle))}</p>
          ${conf.focus ? `<span class="conf-focus">${esc(conf.focus)}</span>` : ""}
        </div>
        <div class="card-actions">
          ${HK.util.starBtn("conf:" + conf.name)}
          <div class="countdown ${cd.cls}">
            <div>${cd.txt}</div>
            <div class="muted" style="font-weight:400">${esc(cd.sub)}</div>
          </div>
        </div>
      </div>
      <ul class="deadline-list">${dlItems}</ul>
      ${guidelines}
      ${typical}
    </div>`;
  }

  let confData = null;
  let filter = "major";   // default to the major meetings; toggle to "all"

  function render() {
    const list = document.getElementById("conf-list");
    if (!list || !confData) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const verified = document.getElementById("conf-verified");
    if (verified && confData.last_verified) {
      verified.textContent = `Deadlines last verified ${confData.last_verified}`;
    }

    const source = (confData.conferences || [])
      .filter((c) => filter === "all" || c.major);

    const ranked = source
      .map((c) => ({ conf: c, info: analyze(c, today) }))
      .sort((a, b) =>
        a.info.group - b.info.group || a.info.sortValue - b.info.sortValue);

    list.innerHTML = ranked.map((r) => card(r.conf, r.info, today)).join("");
  }

  function wireToggle() {
    const toggle = document.getElementById("conf-toggle");
    if (!toggle || toggle.dataset.wired) return;
    toggle.dataset.wired = "1";
    toggle.addEventListener("click", (e) => {
      const btn = e.target.closest(".seg");
      if (!btn) return;
      filter = btn.dataset.confFilter;
      toggle.querySelectorAll(".seg").forEach((b) =>
        b.classList.toggle("active", b === btn));
      render();
    });
  }

  HK.renderConferences = function (data) {
    confData = data;
    wireToggle();
    render();
  };
})();
