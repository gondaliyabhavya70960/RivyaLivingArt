#!/usr/bin/env python3
"""
Phase 07 — Higgsfield asset audit.

Reads the Higgsfield generation history captured from the MCP `show_generations`
endpoint and produces the deterministic Rivya asset manifest consumed by the
Cloudinary migration (Phase 06) and the content seed (Phase 09).

Input : data/higgsfield/raw/images.json, data/higgsfield/raw/videos.json
Output: data/higgsfield/asset-manifest.json

Classification is score-based and multi-label: every asset records all matched
subject tags, and a primary family chosen by the highest weighted score. Ties
break on rule order, so the output is stable across runs.
"""
import json, re, collections, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
RAW = ROOT / "data/higgsfield/raw"
OUT = ROOT / "data/higgsfield/asset-manifest.json"

# family, page, section, cloudinary folder, [(keyword, weight), ...]
# Subject/object cues score higher than scene/process cues so that a
# "hands polishing a serving tray" shot files under decor with a process tag,
# not the other way round.
RULES = [
 ("preservation-varmala", "collection/preservation", "hero", "rivya/collection/preservation", [
   ("varmala",6),("garland",6),("marigold",3),("wedding flower",4),("dried wedding",4),
   ("rose petal",2),("haldi",3),("wedding keepsake",4)]),
 ("preservation-keepsake", "collection/preservation", "gallery", "rivya/collection/preservation", [
   ("keepsake",6),("preservation block",6),("preserved",4),("handprint",6),("footprint",6),
   ("invitation card",5),("flower press",5),("blotting paper",4),("silica",4),("drying rack",4)]),
 ("largeformat-dining", "large-format", "dining-tables", "rivya/large-format/dining", [
   ("dining table",8),("river table",8),("dining-table",8),("conference table",7),("banquet",5)]),
 ("largeformat-coffee", "large-format", "coffee-tables", "rivya/large-format/coffee", [
   ("coffee table",8),("coffee-table",8),("centre table",8),("center table",8)]),
 ("largeformat-console", "large-format", "consoles", "rivya/large-format/console", [
   ("console table",8),("console-table",8),("console",5)]),
 ("largeformat-seating", "large-format", "sculptural-seating", "rivya/large-format/seating", [
   ("chair",7),("chair-seat",8),("bench-seat",8),("bench seat",8),("stool",6),("seating",5)]),
 ("largeformat-side", "large-format", "side-pieces", "rivya/large-format/side", [
   ("side table",8),("side-table",8),("desk",5),("vanity",5)]),
 ("largeformat-monumental", "large-format", "architectural", "rivya/large-format/architectural", [
   ("monumental",8),("lobby",7),("freestanding",5),("spatial installation",7)]),
 ("wall-art", "collection/wall-statement-art", "gallery", "rivya/collection/wall-art", [
   ("wall panel",8),("wall artwork",8),("wall art",8),("wall piece",7),("framed",5),
   ("resin panel",6),("plaque",5),("gallery wall",7),("lithophane",6)]),
 ("three-d-resin", "collection/3d-resin", "gallery", "rivya/collection/3d-resin", [
   ("3d print",8),("3d-print",8),("3d printer",8),("fdm",8),("filament",7),("lattice",7),
   ("petg",7),("matte pla",7),("figurine",6),("nameplate",6),("scale model",6),("print bed",7),
   ("additive",6),("printed",5)]),
 ("decor", "collection/decor", "gallery", "rivya/collection/decor", [
   ("coaster",7),("serving tray",7),("serving board",7),("vase",7),("thali",7),("pooja",7),
   ("tablescape",7),("napkin",5),("candle",5),("tea-light",6),("diya",6),("clock",6),
   ("mirror",6),("pen rest",5),("paperweight",5),("bookmark",5),("pendant",5),("necklace",5)]),
 ("gifts", "collection/gifts", "gallery", "rivya/collection/gifts", [
   ("gift",7),("rakhi",7),("diwali",6),("navratri",6),("ornament",5),("trophy",6),("award",6),
   ("medallion",6),("memento",6),("corporate",6),("gift box",8),("wrapped",4),("ribbon",4)]),
 ("process-pour", "process", "pour", "rivya/process/pour", [
   ("mid-pour",7),("pouring",6),("pour cup",6),("cascading",5),("levelling",5),("leveling",5),
   ("unbroken ribbon",6),("mixing cup",5)]),
 ("process-mould", "process", "mould", "rivya/process/mould", [
   ("mould",6),("mold",6),("formwork",7),("demoulded",7),("silicone",5),("dam of",5)]),
 ("process-cure", "process", "cure", "rivya/process/cure", [
   ("curing",6),("cure room",8),("dust cover",6),("levelled shelves",6),("hourglass",5)]),
 ("process-finish", "process", "finish", "rivya/process/finish", [
   ("sanding",7),("wet-sand",7),("polishing",6),("buff",6),("heat gun",6),("torch",6),
   ("gloss contrast",6),("polishing pad",7),("hand plane",6)]),
 ("process-pigment", "process", "pigment", "rivya/process/pigment", [
   ("pigment",6),("mica",6),("swatch",5),("tint",4),("moodboard",6),("pigment jar",7)]),
 ("process-timber", "process", "timber", "rivya/process/timber", [
   ("timber slab",8),("rough-sawn",7),("wood grain",6),("walnut grain",7),("teak grain",7),
   ("live edge",5),("live-edge",5),("laminated timber",6)]),
 ("process-studio", "process", "studio", "rivya/process/studio", [
   ("workbench",6),("workshop",5),("atelier",7),("tool wall",7),("studio table",5),
   ("artisan",4),("studio at night",6),("workshop bench",6)]),
 ("material-macro", "about", "material-palette", "rivya/material", [
   ("extreme macro",6),("abstract macro",6),("macro of",4),("cured resin surface",6),
   ("texture",4),("ocean-wave",4),("ocean wave",4),("laminar",6),("caustic",5),("gold leaf",4)]),
 ("interior-lifestyle", "home", "interior", "rivya/interior", [
   ("living room",7),("bedroom",7),("study —",7),("dining room",7),("entryway",7),
   ("japandi",7),("mediterranean",7),("brutalist",7),("interior",4),("home",3),("shelf",3)]),
 ("gallery-scene", "portfolio", "gallery", "rivya/portfolio/gallery", [
   ("gallery room",8),("dark gallery",8),("gallery lighting",7),("pedestal",7),("museum",7),
   ("gallery-like",7)]),
 ("workshop-session", "journal", "workshop", "rivya/journal/workshop", [
   ("seated along",7),("four seats",7),("private workshop",8),("eight places",7),
   ("small group",6),("participants",6),("evening workshop",7),("workshop scene",5)]),
 ("editorial", "journal", "editorial", "rivya/journal/editorial", [
   ("editorial photograph",5),("social share card",7),("flat-lay",6),("still life",5),
   ("care product",6),("packing",5),("bubble wrap",6),("comparison",5),("planner",5)]),
]

# Keywords that are pure negative-prompt boilerplate must never score.
NEGATIVE_CONTEXT = re.compile(
    r"no (?:text|logos?|watermarks?|faces?|people|neon|glow|hands?|objects?|heavy gold)", re.I)


def strip_negatives(prompt: str) -> str:
    return NEGATIVE_CONTEXT.sub(" ", prompt)


def kw_regex(kw: str) -> re.Pattern:
    # Word-boundary match so "pla" can never hit "plaque"/"plain"/"display".
    return re.compile(r"(?<![a-z0-9])" + re.escape(kw) + r"(?![a-z0-9])", re.I)


COMPILED = [(f, pg, sec, fol, [(kw_regex(k), w, k) for k, w in kws])
            for f, pg, sec, fol, kws in RULES]


def classify(prompt: str):
    text = strip_negatives(prompt)
    scores, tags = {}, []
    for fam, page, section, folder, kws in COMPILED:
        s = sum(w for rx, w, _ in kws if rx.search(text))
        if s:
            scores[fam] = (s, page, section, folder)
            tags.append(fam)
    if not scores:
        return "editorial", "journal", "editorial", "rivya/journal/editorial", []
    order = {f: i for i, (f, *_ ) in enumerate(RULES)}
    best = min(scores.items(), key=lambda kv: (-kv[1][0], order[kv[0]]))
    fam, (_, page, section, folder) = best
    return fam, page, section, folder, sorted(tags)


def alt_draft(prompt: str) -> str:
    p = prompt.split("—")[0]
    p = re.split(r"(?<=[a-z])\.\s", p)[0]
    p = re.sub(r"^(one frame from |one of four |use the reference image as the exact base\.?\s*)",
               "", p, flags=re.I)
    p = re.sub(r"\s+", " ", p).strip().rstrip(",;.")
    if len(p) > 180:
        p = p[:177].rsplit(" ", 1)[0] + "…"
    return (p[0].upper() + p[1:]) if p else "Rivya Living Art concept still."


def build(records, kind, counters):
    """Number within a counter namespace shared across media types.

    Images and videos land in the same subject families, so separate counters
    would mint the same Rivya asset ID twice. The ID is the authoritative key
    (filenames are not), so the namespace must be shared.
    """
    out = []
    for r in sorted(records, key=lambda x: (-(x.get("created") or 0), x["id"])):
        fam, page, section, folder, tags = classify(r["prompt"])
        counters[fam] += 1
        ar = (r.get("ar") or "na").replace(":", "x")
        slug = f"{fam}-{counters[fam]:03d}-{ar}"
        out.append({
            "rivya_asset_id": f"{fam}-{counters[fam]:03d}".upper(),
            "filename": f"{slug}.{'mp4' if kind == 'video' else 'webp'}",
            "type": kind,
            "family": fam,
            "subject_tags": tags,
            "page": page,
            "section": section,
            "cloudinary_folder": folder,
            "cloudinary_public_id": f"{folder}/{slug}",
            "aspect_ratio": r.get("ar"),
            "width": r.get("w"),
            "height": r.get("h"),
            "duration_s": r.get("duration"),
            "source": "higgsfield",
            "higgsfield_generation_id": r["id"],
            "higgsfield_model": r["model"],
            "source_url": r["url"],
            # The webp variant Higgsfield serves alongside the original. NOT a downscale —
            # same pixel dimensions, an order of magnitude smaller. It is what Phase 06
            # migrates: the source PNGs run past 20 MB and the Cloudinary plan caps images
            # at 10 MB, while the webp of the same asset is under half a megabyte.
            "source_min_url": r.get("min_url"),
            "prompt": r["prompt"],
            "alt_text_draft": alt_draft(r["prompt"]),
            "is_ai_generated": True,
            "is_concept": True,
            "status": "AVAILABLE_UNMIGRATED",
            "owner_verification": "OWNER_VERIFICATION_REQUIRED",
            "used_in_cms": False,
            "cms_placement": None,
        })
    return out


def main():
    imgs = json.loads((RAW / "images.json").read_text())
    vids = json.loads((RAW / "videos.json").read_text())
    counters = collections.Counter()
    assets = build(imgs, "image", counters) + build(vids, "video", counters)

    ids = [a["rivya_asset_id"] for a in assets]
    dupes = [i for i, n in collections.Counter(ids).items() if n > 1]
    if dupes:
        raise SystemExit(f"duplicate Rivya asset IDs: {sorted(dupes)}")
    pids = [a["cloudinary_public_id"] for a in assets]
    dupe_pids = [i for i, n in collections.Counter(pids).items() if n > 1]
    if dupe_pids:
        raise SystemExit(f"duplicate Cloudinary public IDs: {sorted(dupe_pids)}")
    manifest = {
        "manifest_version": "rivya-hf-v1",
        "generated_by": "scripts/media/build-higgsfield-manifest.py (Phase 07)",
        "source": "Higgsfield AI generation history (private workspace ec502e11-f7e3-42e6-b11b-cca2088dbd9c)",
        "policy": {
            "asset_priority": [
                "1. Verified real Rivya product media",
                "2. Existing approved user-provided asset",
                "3. Existing approved Higgsfield asset  <-- this manifest",
                "4. Existing suitable Rivya project/render",
                "5. Generate new Higgsfield asset",
                "6. Temporary technical fallback only if unavoidable",
            ],
            "rules": [
                "AI concept media must never be presented as completed, delivered Rivya work.",
                "No fabricated product name, price, dimension, material or lead time may be attached to these assets.",
                "Every asset carries is_ai_generated=true and is_concept=true on the media row.",
                "source_url is the Higgsfield CDN origin; production delivery is Cloudinary after Phase 06 migration.",
                "Regenerating an asset already present here violates the asset-priority rule.",
            ],
        },
        "counts": {
            "total": len(assets),
            "image": sum(1 for a in assets if a["type"] == "image"),
            "video": sum(1 for a in assets if a["type"] == "video"),
            "by_family": dict(sorted(collections.Counter(a["family"] for a in assets).items())),
            "by_page": dict(sorted(collections.Counter(a["page"] for a in assets).items())),
            "by_aspect_ratio": dict(sorted(collections.Counter(str(a["aspect_ratio"]) for a in assets).items())),
        },
        "assets": assets,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {OUT.relative_to(ROOT)} — {len(assets)} assets", file=sys.stderr)
    print(json.dumps(manifest["counts"], indent=1))


if __name__ == "__main__":
    main()
