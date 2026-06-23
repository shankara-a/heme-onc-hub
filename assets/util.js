/* util.js — shared helpers: dates, .ics calendar export, and a "saved" store.
   Loaded before the other modules. Exposes HK.util and HK.store, and wires global
   click handling for .star-btn and .cal-btn buttons rendered anywhere in the app. */
window.HK = window.HK || {};

(function () {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n) => String(n).padStart(2, "0");

  function escAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/"/g, "&quot;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function icsEsc(s) {
    return String(s == null ? "" : s)
      .replace(/\\/g, "\\\\").replace(/;/g, "\\;")
      .replace(/,/g, "\\,").replace(/\n/g, "\\n");
  }
  function ymd(d) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; }

  HK.util = {
    parseDate(s) {
      if (!s) return null;
      const [y, m, d] = String(s).split("-").map(Number);
      if (!y || !m || !d) return null;
      return new Date(y, m - 1, d);
    },
    fmtDate(d) {
      return d ? `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` : "";
    },
    today() { const t = new Date(); t.setHours(0, 0, 0, 0); return t; },
    daysUntil(d) { return Math.ceil((d - HK.util.today()) / 86400000); },
    escAttr,

    // Download an all-day .ics event with a reminder alarm N days before.
    downloadICS({ title, date, description = "", url = "", reminderDays = 7 }) {
      const dt = typeof date === "string" ? HK.util.parseDate(date) : date;
      if (!dt) return;
      const endDate = new Date(dt); endDate.setDate(dt.getDate() + 1);
      const now = new Date();
      const stamp = `${ymd(now)}T${pad(now.getHours())}${pad(now.getMinutes())}00Z`;
      const uid = `${ymd(dt)}-${(title || "deadline").replace(/[^a-z0-9]/gi, "").slice(0, 20)}@hemeonckhub`;
      const lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Heme-Onc K-Hub//EN",
        "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
        `UID:${uid}`, `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${ymd(dt)}`, `DTEND;VALUE=DATE:${ymd(endDate)}`,
        `SUMMARY:${icsEsc(title)}`,
        description ? `DESCRIPTION:${icsEsc(description)}` : null,
        url ? `URL:${icsEsc(url)}` : null,
        "BEGIN:VALARM", `TRIGGER:-P${reminderDays}D`, "ACTION:DISPLAY",
        `DESCRIPTION:${icsEsc(title)}`, "END:VALARM",
        "END:VEVENT", "END:VCALENDAR",
      ].filter(Boolean);
      const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (title || "deadline").replace(/[^a-z0-9]+/gi, "-").slice(0, 50) + ".ics";
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    },

    // Markup helpers (initial state read from the store).
    starBtn(id) {
      const on = HK.store.isSaved(id);
      return `<button class="star-btn ${on ? "on" : ""}" data-id="${escAttr(id)}" ` +
             `title="Save to your shortlist" aria-pressed="${on}">${on ? "★" : "☆"}</button>`;
    },
    calBtn({ title, date, description = "", url = "" }) {
      if (!date) return "";
      return `<button class="cal-btn" data-title="${escAttr(title)}" data-date="${escAttr(date)}" ` +
             `data-desc="${escAttr(description)}" data-url="${escAttr(url)}" ` +
             `title="Add to calendar (.ics)">📅</button>`;
    },
  };

  /* ---- saved/shortlist store (single namespace, stable string ids) ---- */
  const KEY = "hkhub.saved";
  function read() {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); }
    catch (e) { return new Set(); }
  }
  HK.store = {
    list() { return read(); },
    isSaved(id) { return read().has(id); },
    count() { return read().size; },
    toggle(id) {
      const s = read();
      s.has(id) ? s.delete(id) : s.add(id);
      localStorage.setItem(KEY, JSON.stringify([...s]));
      return s.has(id);
    },
  };

  /* ---- global delegation for star + calendar buttons ---- */
  document.addEventListener("click", (e) => {
    const star = e.target.closest(".star-btn");
    if (star) {
      e.preventDefault(); e.stopPropagation();
      const on = HK.store.toggle(star.dataset.id);
      star.classList.toggle("on", on);
      star.textContent = on ? "★" : "☆";
      star.setAttribute("aria-pressed", on);
      document.dispatchEvent(new CustomEvent("hk:saved", { detail: { id: star.dataset.id, on } }));
      return;
    }
    const cal = e.target.closest(".cal-btn");
    if (cal) {
      e.preventDefault(); e.stopPropagation();
      HK.util.downloadICS({
        title: cal.dataset.title, date: cal.dataset.date,
        description: cal.dataset.desc, url: cal.dataset.url,
      });
    }
  });
})();
