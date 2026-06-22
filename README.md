# Heme/Onc K-Hub 🩸

A web tool for hematology-oncology fellows and faculty that brings together, in one place:

- **NIH K-award grant library** — active career-development (K-series) awards relevant to
  heme/onc, pulled live from the [NIH RePORTER API](https://api.reporter.nih.gov/) and
  refreshed weekly, with filtering/sorting and a personal shortlist.
- **Conference deadlines** — abstract submission deadlines and submission guidelines for the
  major meetings in our field (AACR, ASCO, ASH, EHA, ESMO, SOHO, SITC, ASTRO, ASCO GI/GU
  symposia, SABCS, ASTCT/CIBMTR Tandem), sorted by the next upcoming deadline. A **Major / All**
  toggle narrows the list to ASH, ASCO, and AACR.
- **Funding (non-NIH)** — curated society & foundation awards that fund heme/onc fellows
  (ASH RTAF & Scholar, Conquer Cancer/ASCO YIA & CDA, LLS/Blood Cancer United, Damon Runyon,
  ACS, AACR fellowships, LRF, PCF, CZI, and more), sorted by next deadline with a category filter.
- **Fellow's Playbook** — which K matches your career stage, the funding ladder, NIH receipt
  dates, a K-prep checklist, and program-officer/study-section pointers.
- **Overview & maps** — charts of awards by subarea/mechanism/type/year, plus top institutions
  and a US map.

Modeled on the [Nephrology K-Grant Hub](https://mhguedes.github.io/nephrology-k-hub/).
It's a static site (no backend) — just HTML, CSS, and vanilla JS, with Chart.js and Leaflet
loaded from a CDN.

## Project layout

```
index.html               # the app + all tabs
assets/                  # styles.css + JS modules (app, charts, grants, map, conferences, funding)
data/
  grants.json            # generated from NIH RePORTER (auto-committed weekly)
  grants_meta.json       # summary stats used by the Overview tab
  conferences.json       # hand-curated deadlines & guidelines — edit this to update dates
  funding.json           # hand-curated non-NIH funding opportunities — edit this to add awards
scripts/fetch_grants.py  # queries NIH RePORTER and rebuilds data/grants*.json
.github/workflows/update-grants.yml   # weekly auto-refresh
```

## Run it locally

The site reads JSON with `fetch()`, so it must be served over HTTP (opening `index.html`
directly via `file://` won't load the data).

```bash
# from the project folder
python3 -m http.server 8000
# then open http://localhost:8000
```

To refresh the grant data:

```bash
pip install -r requirements.txt
python3 scripts/fetch_grants.py      # rewrites data/grants.json + data/grants_meta.json
```

## Updating conference deadlines

Deadlines change every year. Edit **`data/conferences.json`** — each conference has a `cycles`
array; add a new entry for the next year (or update dates in place) and bump `last_verified`
at the top of the file. The Conference Deadlines tab automatically re-sorts by the next
upcoming deadline and strikes through past ones. Dates use `YYYY-MM-DD`; set a deadline's
`date` to `null` with a `note` for "TBA / typically <month>" entries.

## Updating funding opportunities

Edit **`data/funding.json`** — each entry has `name`, `org`, `category`
(`Society` / `Foundation` / `Disease-specific`), `focus`, `stage`, `amount`, `duration`,
`eligibility`, a `deadlines` array (same `YYYY-MM-DD` / `null` + `note` format as conferences),
`typical_timing`, and `url`. The Funding tab re-sorts by next deadline and filters by category.
Append new awards to share more options with co-fellows.

## Publish to GitHub Pages (one-time setup)

This is the part that needs your GitHub account.

1. **Create the repo.** On GitHub, click **New repository**, name it (e.g. `heme-onc-hub`),
   make it **Public**, and create it (don't add a README — this folder already has one).
2. **Push this folder.** From the project directory:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Heme/Onc K-Hub"
   git branch -M main
   git remote add origin https://github.com/<your-username>/heme-onc-hub.git
   git push -u origin main
   ```
3. **Enable Pages.** Repo **Settings → Pages** → under *Build and deployment*, set **Source:
   Deploy from a branch**, **Branch: `main`**, **Folder: `/ (root)`**, then **Save**.
   Your site goes live at `https://<your-username>.github.io/heme-onc-hub/` (give it a minute).
4. **Allow the weekly refresh to commit.** Repo **Settings → Actions → General** → scroll to
   *Workflow permissions* → choose **Read and write permissions** → **Save**.
5. **Test the auto-update now.** Repo **Actions** tab → **Update grant data** → **Run workflow**.
   It fetches fresh data from NIH RePORTER and commits `data/grants*.json`; Pages redeploys
   automatically. After this, it runs every Monday on its own.

Share the Pages URL with your co-fellows — that's all they need.

## How it classifies grants

See the **Methodology** tab in the app. In short: all NCI K-awards are included; NHLBI
K-awards are included only when they classify into a hematology subarea (so cardiology/
pulmonary awards are excluded). Subarea and clinical-vs-lab labels are assigned by keyword
matching on each award's title and Public Health Relevance statement — approximations, with
every row linking to its authoritative RePORTER record.

## Corrections

Grant classification is automated and imperfect, and conference dates move. To fix something,
open an issue or PR on the repo (edit `data/conferences.json` for deadlines, or adjust the
keyword rules in `scripts/fetch_grants.py` for grant classification).

---

*Not affiliated with NIH or any medical society. Always verify abstract deadlines on the
official conference site before relying on them.*
