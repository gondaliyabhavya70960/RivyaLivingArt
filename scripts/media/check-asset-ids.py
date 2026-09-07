#!/usr/bin/env python3
"""
Guard: a planned (GAP) asset ID must never collide with an ID the manifest
allocator can mint.

Two allocators share one ID namespace. `build-higgsfield-manifest.py` mints
`<FAMILY>-<NNN>` by counting within a family; the media documents mint IDs for
assets that do not exist yet. If a gap ID borrows an existing family prefix it
either collides today or collides the moment another asset joins that family —
so gap IDs use the SEED §50 `<PAGE>-<SECTION>[-<KIND>]-<NNN>` form instead.

Exit 1 on any collision. Run in CI and before any media migration.
"""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[2]
manifest = json.loads((ROOT / "data/higgsfield/asset-manifest.json").read_text())

existing = {a["rivya_asset_id"] for a in manifest["assets"]}
families = {f.upper() for f in manifest["counts"]["by_family"]}

ID = re.compile(r"\b([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+-\d{3})\b")
# The requirements folder holds the specifications verbatim and is never edited.
DOCS = [p for p in ROOT.glob("docs/**/*.md") if "requirements" not in p.parts]

problems = []
for path in sorted(DOCS):
    for cited in sorted(set(ID.findall(path.read_text()))):
        if cited in existing:
            continue  # a real asset, correctly referenced
        prefix = cited.rsplit("-", 1)[0]
        if prefix in families:
            problems.append(
                f"{path.relative_to(ROOT)}: gap ID {cited} reuses manifest family "
                f"prefix {prefix} — use the <PAGE>-<SECTION>[-<KIND>]-<NNN> form"
            )

for p in problems:
    print(f"  {p}", file=sys.stderr)
print(f"checked {len(DOCS)} documents against {len(existing)} manifest IDs: "
      f"{len(problems)} collision(s)")
sys.exit(1 if problems else 0)
