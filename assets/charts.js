/* charts.js — Overview tab Chart.js visualizations. Exposes HK.renderCharts(meta). */
window.HK = window.HK || {};

(function () {
  const PALETTE = [
    "#b3122b", "#0e7c86", "#d97706", "#4f46e5", "#0891b2",
    "#be185d", "#65a30d", "#7c3aed", "#ea580c", "#0d9488",
  ];
  const charts = {};

  function destroy(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  }

  function objToSorted(obj, byKey) {
    const entries = Object.entries(obj || {});
    if (byKey) entries.sort((a, b) => a[0].localeCompare(b[0]));
    return { labels: entries.map((e) => e[0]), values: entries.map((e) => e[1]) };
  }

  function bar(id, obj, color, byKey) {
    const el = document.getElementById(id);
    if (!el) return;
    destroy(id);
    const { labels, values } = objToSorted(obj, byKey);
    charts[id] = new Chart(el, {
      type: "bar",
      data: { labels, datasets: [{ data: values, backgroundColor: color, borderRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { autoSkip: false, maxRotation: 55, minRotation: 0, font: { size: 11 } }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    });
  }

  function doughnut(id, obj) {
    const el = document.getElementById(id);
    if (!el) return;
    destroy(id);
    const { labels, values } = objToSorted(obj);
    charts[id] = new Chart(el, {
      type: "doughnut",
      data: { labels, datasets: [{ data: values, backgroundColor: PALETTE }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "right", labels: { boxWidth: 12, font: { size: 11 } } } },
      },
    });
  }

  HK.renderCharts = function (meta) {
    if (!meta) return;
    doughnut("chart-subarea", meta.by_subarea);
    bar("chart-mechanism", meta.by_mechanism, "#b3122b");
    doughnut("chart-type", meta.by_research_type);
    bar("chart-fy", meta.by_fiscal_year, "#0e7c86", true);
    bar("chart-start", meta.by_start_year, "#4f46e5", true);
  };
})();
