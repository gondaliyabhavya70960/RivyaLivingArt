# Rivya Living Art

A luxury digital flagship showroom for a contemporary resin, timber and digital-fabrication
studio — and the internal operating system that runs it.

```
WOOD → RESIN → LIGHT → FORM → SPACE → ART
```

## What this is

Two systems in one repository:

- **The public website** — cinematic, material-first, large-format-first. Collectible furniture,
  sculptural resin objects, statement art, preservation pieces, décor and gifts, presented so that
  a visitor can genuinely understand an object before enquiring.
- **Rivya Studio** — the private workspace at `/studio` where the owner runs catalog, content,
  media, merchandising, inquiries, competitive research and operations without touching code.

There is no checkout, no payment gateway and no customer accounts. Every conversion path ends in a
persisted inquiry followed by a WhatsApp handoff.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · Supabase PostgreSQL · Supabase Auth ·
Cloudinary · Vercel · Higgsfield AI · GitHub

## Current state

Planning baseline — specifications, architecture contract, the full 47-phase implementation plan
and a 250-asset media inventory are in place; application code has not been written yet.
See [`PROJECT_STATE.md`](PROJECT_STATE.md) for the verified per-phase status.

## Start here

| If you want to… | Read |
|---|---|
| Pick up work | [`docs/SESSION-STATE.md`](docs/SESSION-STATE.md) |
| Know what is actually built | [`PROJECT_STATE.md`](PROJECT_STATE.md) |
| Understand the business | [`CONTEXT.md`](CONTEXT.md) |
| Follow the rules | [`CLAUDE.md`](CLAUDE.md) · [`docs/architecture/CANONICAL-DECISIONS.md`](docs/architecture/CANONICAL-DECISIONS.md) |
| See the plan | [`docs/project/ROADMAP.md`](docs/project/ROADMAP.md) |
| Work with media | [`docs/media/HIGGSFIELD_MASTER_ASSET_PLAN.md`](docs/media/HIGGSFIELD_MASTER_ASSET_PLAN.md) |

## Media inventory

250 Higgsfield assets (224 images, 26 videos) already exist and are catalogued in
`data/higgsfield/asset-manifest.json`. Rebuild the manifest from the raw generation history with:

```bash
python3 scripts/media/build-higgsfield-manifest.py
```

Nothing already in the manifest may be regenerated — see the asset-priority rule in
[`CLAUDE.md`](CLAUDE.md).
