#!/usr/bin/env python3
"""
fetch_grants.py — Build the Heme/Onc K-Hub grant dataset from the NIH RePORTER API.

Queries NIH RePORTER (https://api.reporter.nih.gov/v2/projects/Search) for active
career-development (K-series) awards relevant to hematology/oncology, classifies each
into a subarea and research type, and writes:

  data/grants.json       - normalized array of awards the website reads
  data/grants_meta.json  - summary stats + last-updated timestamp + "new since last run"

Scope:
  - All NCI (National Cancer Institute) K-awards.
  - NHLBI K-awards that match benign-hematology terms (sickle cell, thrombosis,
    bone marrow failure, hematopoiesis, etc.) so we capture benign heme without
    pulling in cardiology/pulmonary awards.

No third-party build tools required; only `requests`.
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timezone

import requests

API_URL = "https://api.reporter.nih.gov/v2/projects/Search"
PAGE_SIZE = 500          # RePORTER max records per page
MAX_RECORDS = 14_900     # RePORTER hard cap on offset+limit
REQUEST_PAUSE = 1.0      # be polite to the API

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.normpath(os.path.join(HERE, "..", "data"))
GRANTS_PATH = os.path.join(DATA_DIR, "grants.json")
META_PATH = os.path.join(DATA_DIR, "grants_meta.json")

# Career-development mechanisms most relevant to heme/onc fellows & early faculty.
ACTIVITY_CODES = ["K08", "K23", "K99", "K12", "K38", "K43", "K01", "K22", "K24"]

# Subareas that count as hematology (used to keep NHLBI awards on-topic — an NHLBI
# award is included only if it classifies into one of these).
HEME_SUBAREAS = {
    "Leukemia / MDS / MPN", "Lymphoma", "Myeloma / Plasma cell",
    "Cellular therapy / BMT", "Benign hematology",
}

# --- Subarea classification. We match on the project TITLE + Public Health Relevance
#     statement (high-signal, disease-focused) rather than the full abstract or the
#     generic NIH term tags, which are too noisy. First match in this order wins. ---

# Unambiguous disease acronyms — matched case-sensitively with word boundaries so
# "ALL"/"MM" don't fire on the common English words "all"/"mm".
SUBAREA_ACRONYMS = [
    ("Leukemia / MDS / MPN", re.compile(r"\b(AML|CML|CLL|ALL|MDS|MPN|CMML|APL)\b")),
    ("Lymphoma", re.compile(r"\b(DLBCL|PTCL|CTCL|NHL)\b")),
    ("Myeloma / Plasma cell", re.compile(r"\b(MGUS)\b")),
]

# Lowercase substring keywords (specific enough not to collide with common prose).
SUBAREA_KEYWORDS = [
    ("Leukemia / MDS / MPN", [
        "leukemia", "leukaemia", "lymphoblastic", "myelodysplas",
        "myeloproliferat", "myeloid neoplasm", "myeloid malignan", "myelofibrosis"]),
    ("Lymphoma", [
        "lymphoma", "hodgkin", "mycosis fungoides", "sezary"]),
    ("Myeloma / Plasma cell", [
        "myeloma", "plasma cell", "monoclonal gammopathy", "amyloidosis"]),
    ("Cellular therapy / BMT", [
        "stem cell transplant", "bone marrow transplant", "hematopoietic cell transplant",
        "hematopoietic stem cell", "car-t", "car t cell", "chimeric antigen receptor",
        "graft-versus", "graft versus host", "gvhd", "cellular therapy",
        "cellular immunotherapy", "adoptive cell"]),
    ("Immuno-oncology", [
        "immunotherap", "immune checkpoint", "checkpoint inhibitor", "pd-1", "pd-l1",
        "ctla-4", "neoantigen", "cancer vaccine", "tumor immunolog",
        "tumor microenvironment", "immune evasion"]),
    ("Benign hematology", [
        "sickle", "hemophilia", "von willebrand", "thrombosis", "thrombotic",
        "thromboembolism", "thrombocytopenia", "bone marrow failure", "aplastic anemia",
        "hemoglobinopath", "thalassemia", "hemostasis", "coagulation", "hematopoiesis",
        "erythropoiesis", "erythroid", "megakaryocyt", "iron overload",
        "hemochromatosis", "fanconi anemia", "paroxysmal nocturnal", "neutropenia"]),
    ("Solid tumor", [
        "breast cancer", "lung cancer", "prostate cancer", "colorectal", "colon cancer",
        "pancrea", "melanoma", "glioma", "glioblastoma", "ovarian", "sarcoma",
        "renal cell", "bladder cancer", "gastric cancer", "hepatocellular",
        "head and neck", "cervical cancer", "endometrial", "esophageal",
        "neuroblastoma", "solid tumor", "carcinoma", "adenocarcinoma"]),
]

# Mechanisms whose intent is inherently patient-oriented / clinical.
CLINICAL_CODES = {"K23", "K12"}
# Strong, specific clinical-research signals (avoid weak terms like "biomarker").
CLINICAL_HINTS = [
    "clinical trial", "randomized", "patient-reported", "survivorship",
    "quality of life", "health dispar", "health services", "implementation science",
    "comparative effectiveness", "patient-oriented", "observational cohort",
    "epidemiolog", "health outcomes", "pragmatic trial", "real-world"]


def post_with_retry(payload, attempts=4):
    """POST to RePORTER with simple exponential backoff."""
    for i in range(attempts):
        try:
            resp = requests.post(API_URL, json=payload, timeout=60)
            if resp.status_code == 200:
                return resp.json()
            # 429/5xx -> back off and retry
            wait = 2 ** i
            print(f"  HTTP {resp.status_code}; retrying in {wait}s", file=sys.stderr)
            time.sleep(wait)
        except requests.RequestException as exc:
            wait = 2 ** i
            print(f"  request error ({exc}); retrying in {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"RePORTER request failed after {attempts} attempts")


def fetch_all(criteria, label):
    """Page through every result for a given criteria block."""
    results = []
    offset = 0
    while offset < MAX_RECORDS:
        payload = {
            "criteria": criteria,
            "offset": offset,
            "limit": PAGE_SIZE,
            "sort_field": "fiscal_year",
            "sort_order": "desc",
        }
        data = post_with_retry(payload)
        batch = data.get("results", []) or []
        total = data.get("meta", {}).get("total", 0)
        results.extend(batch)
        print(f"  [{label}] fetched {len(results)}/{total}")
        if not batch or len(results) >= total:
            break
        offset += PAGE_SIZE
        time.sleep(REQUEST_PAUSE)
    return results


def signal_text(rec):
    """High-signal classification text: title + Public Health Relevance statement."""
    title = rec.get("project_title") or ""
    phr = rec.get("phr_text") or ""
    original = f"{title} {phr}"
    return original, original.lower()


def classify_subarea(original, blob):
    for subarea, keywords in SUBAREA_KEYWORDS:
        if any(k in blob for k in keywords):
            return subarea
        for acro_subarea, pattern in SUBAREA_ACRONYMS:
            if acro_subarea == subarea and pattern.search(original):
                return subarea
    return "Other / Multi-cancer"


def classify_research_type(activity_code, blob):
    if activity_code in CLINICAL_CODES:
        return "Patient-oriented / Clinical"
    if any(h in blob for h in CLINICAL_HINTS):
        return "Patient-oriented / Clinical"
    return "Laboratory / Translational"


def normalize(rec, agency_label):
    org = rec.get("organization") or {}
    ic = rec.get("agency_ic_admin") or {}
    pis = rec.get("principal_investigators") or []
    pi_name = rec.get("contact_pi_name") or (
        pis[0].get("full_name") if pis and isinstance(pis[0], dict) else "")
    pos = rec.get("program_officers") or []
    po_name = pos[0].get("full_name") if pos and isinstance(pos[0], dict) else ""
    original, blob = signal_text(rec)
    activity = rec.get("activity_code") or ""
    start = rec.get("project_start_date") or ""
    start_year = None
    if start and len(start) >= 4 and start[:4].isdigit():
        start_year = int(start[:4])
    return {
        "core_project_num": rec.get("core_project_num") or rec.get("project_num"),
        "appl_id": rec.get("appl_id"),
        "title": (rec.get("project_title") or "").strip(),
        "pi": pi_name.title() if pi_name else "",
        "org": org.get("org_name") or "",
        "city": (org.get("org_city") or "").title(),
        "state": org.get("org_state") or "",
        "country": org.get("org_country") or "",
        "mechanism": activity,
        "subarea": classify_subarea(original, blob),
        "research_type": classify_research_type(activity, blob),
        "amount": rec.get("award_amount") or 0,
        "fiscal_year": rec.get("fiscal_year"),
        "start_year": start_year,
        "ic": ic.get("abbreviation") or agency_label,
        "po": po_name.title() if po_name else "",
        "url": rec.get("project_detail_url")
        or f"https://reporter.nih.gov/project-details/{rec.get('appl_id')}",
    }


def dedupe_latest(records):
    """Keep one row per core project number — the most recently funded year."""
    by_core = {}
    for r in records:
        key = r["core_project_num"]
        if not key:
            continue
        prev = by_core.get(key)
        if prev is None or (r.get("fiscal_year") or 0) > (prev.get("fiscal_year") or 0):
            by_core[key] = r
    return list(by_core.values())


def load_previous_cores():
    if not os.path.exists(GRANTS_PATH):
        return set()
    try:
        with open(GRANTS_PATH, encoding="utf-8") as fh:
            return {g["core_project_num"] for g in json.load(fh)}
    except (json.JSONDecodeError, KeyError, OSError):
        return set()


def build_meta(grants, new_cores):
    def tally(key):
        out = {}
        for g in grants:
            out[g[key] or "Unknown"] = out.get(g[key] or "Unknown", 0) + 1
        return dict(sorted(out.items(), key=lambda kv: -kv[1]))

    by_state = {}
    for g in grants:
        if g["state"]:
            by_state[g["state"]] = by_state.get(g["state"], 0) + 1

    by_fy = {}
    for g in grants:
        if g["fiscal_year"]:
            by_fy[str(g["fiscal_year"])] = by_fy.get(str(g["fiscal_year"]), 0) + 1

    by_start = {}
    for g in grants:
        if g["start_year"]:
            by_start[str(g["start_year"])] = by_start.get(str(g["start_year"]), 0) + 1

    top_orgs = {}
    for g in grants:
        if g["org"]:
            top_orgs[g["org"]] = top_orgs.get(g["org"], 0) + 1
    top_orgs = dict(sorted(top_orgs.items(), key=lambda kv: -kv[1])[:20])

    return {
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "total_awards": len(grants),
        "total_funding": sum(g["amount"] for g in grants),
        "new_since_last": sorted(new_cores),
        "new_count": len(new_cores),
        "by_subarea": tally("subarea"),
        "by_mechanism": tally("mechanism"),
        "by_research_type": tally("research_type"),
        "by_state": dict(sorted(by_state.items(), key=lambda kv: -kv[1])),
        "by_fiscal_year": dict(sorted(by_fy.items())),
        "by_start_year": dict(sorted(by_start.items())),
        "top_orgs": top_orgs,
        "activity_codes": ACTIVITY_CODES,
    }


def main():
    print("Fetching NCI K-awards...")
    nci = fetch_all({
        "activity_codes": ACTIVITY_CODES,
        "agencies": ["NCI"],
        "include_active_projects": True,
    }, "NCI")

    print("Fetching NHLBI K-awards (heme-filtered)...")
    nhlbi_raw = fetch_all({
        "activity_codes": ACTIVITY_CODES,
        "agencies": ["NHLBI"],
        "include_active_projects": True,
    }, "NHLBI")

    # All NCI K-awards are in scope. NHLBI awards are kept only if they classify
    # into a hematology subarea (so cardiology/pulmonary awards are excluded).
    norm = [normalize(r, "NCI") for r in nci]
    for r in nhlbi_raw:
        n = normalize(r, "NHLBI")
        if n["subarea"] in HEME_SUBAREAS:
            norm.append(n)

    grants = dedupe_latest(norm)
    grants.sort(key=lambda g: (-(g["fiscal_year"] or 0), g["org"], g["pi"]))

    prev_cores = load_previous_cores()
    new_cores = {g["core_project_num"] for g in grants} - prev_cores if prev_cores else set()

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(GRANTS_PATH, "w", encoding="utf-8") as fh:
        json.dump(grants, fh, indent=1, ensure_ascii=False)
    with open(META_PATH, "w", encoding="utf-8") as fh:
        json.dump(build_meta(grants, new_cores), fh, indent=1, ensure_ascii=False)

    print(f"\nWrote {len(grants)} awards -> {GRANTS_PATH}")
    print(f"New since last run: {len(new_cores)}")


if __name__ == "__main__":
    main()
