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

Built. Phases 00–44 are complete or development-complete, Phase 45 is PARTIAL and Phase 46 — this
documentation and handoff phase — is the last. The public website, Rivya Studio, the research
workspace, SEO, performance, accessibility, the test suite and the Vercel deployment all exist and
run. [`docs/project/ROADMAP.md`](docs/project/ROADMAP.md) carries a status for every one of the 47
phases and [`PROJECT_STATE.md`](PROJECT_STATE.md) carries the evidence behind each.

**What is NOT done is the owner's, not the code's:** the catalogue is empty by design, nothing is
published until somebody publishes it, and a long list of seeded copy is held back as
`OWNER_VERIFICATION_REQUIRED` until the owner confirms it is true. That list is generated into
[`docs/content/INITIAL_CONTENT_INVENTORY.md`](docs/content/INITIAL_CONTENT_INVENTORY.md) and shown
as a card on `/studio`.

## Start here

| If you want to… | Read |
|---|---|
| Pick up work | [`docs/SESSION-STATE.md`](docs/SESSION-STATE.md) |
| Know what is actually built | [`PROJECT_STATE.md`](PROJECT_STATE.md) |
| Understand the business | [`CONTEXT.md`](CONTEXT.md) |
| Follow the rules | [`CLAUDE.md`](CLAUDE.md) · [`docs/architecture/CANONICAL-DECISIONS.md`](docs/architecture/CANONICAL-DECISIONS.md) |
| See the plan | [`docs/project/ROADMAP.md`](docs/project/ROADMAP.md) |
| Work with media | [`docs/media/HIGGSFIELD_MASTER_ASSET_PLAN.md`](docs/media/HIGGSFIELD_MASTER_ASSET_PLAN.md) |

## From a clean clone

**Measured, not asserted** — Phase 46, on 2026-09-12, in a directory with no prior state, cloning
from `origin` over the network. D9's tenth condition is that the repository stays recoverable, and a
runbook nobody has executed is a guess.

| Step | Command | Elapsed | Result |
|---|---|---|---|
| 1 | `git clone https://github.com/gondaliyabhavya70960/RivyaLivingArt.git` | 2 s | ✅ |
| 2 | `npm ci` | 19 s | ✅ |
| 3 | `createdb rivya` | 0 s | ✅ |
| 4 | `npm run db:reset` | 7 s | ✅ 109 migrations replayed from empty |
| 5 | `npm run seed:content` | 2 s | ✅ |
| 6 | *the two manual steps below* | — | ⚠️ **not in any documented sequence until now** |
| 7 | `npm run build` | 73 s | ✅ cold, no `.next` |
| 8 | `npm run check` | 149 s | ✅ 36 gates |
| 9 | `npm run test:unit` | 105 s | ✅ |

**Roughly six minutes of machine time**, plus step 6.

### Step 6 — the two things the sequence omitted

Running the documented sequence verbatim **fails at `npm run build`**, twice, for two different
reasons. Both are setup, not defects, and both are written down here because the first person to
follow the old sequence would have hit them with nothing to read.

1. **The environment must exist.** `next build` reads `NEXT_PUBLIC_SUPABASE_URL` and its siblings at
   build time and throws `Missing required environment variable` without them. Copy `.env.example`
   and fill it in — [`docs/ops/ENVIRONMENT.md`](docs/ops/ENVIRONMENT.md) says what each name is for
   and who sets it. Nothing in steps 1–5 creates this file.
2. **The database must be reachable over HTTP, not just over `psql`.** The build renders CMS routes,
   so it queries the database while building; `DATABASE_URL` alone is not enough. Against a real
   Supabase project this is automatic. Locally it means the PostgREST shim
   (`node scripts/db/local-rest.mjs`), and the anon key must be **the one that shim minted for this
   run** — it prints it, and `.github/workflows/ci.yml` reads it straight back out of the log. A key
   from an earlier run fails with `No suitable key or wrong key type`, which does not sound like a
   key mismatch and cost an hour the first time.

### What could not be run here, and why

Recorded rather than quietly skipped:

| Step in the phase document | State |
|---|---|
| `nvm use` | **No `.nvmrc` exists.** The command has nothing to read. Node 22 works; the version is unpinned |
| `supabase start` | **No Supabase CLI in this environment.** The local harness uses PostgreSQL 16 directly plus the PostgREST shim instead — [`docs/ops/TESTING.md`](docs/ops/TESTING.md) documents that harness |
| `npx playwright test` | **Not run in the clone.** CI runs it on every push, sharded four ways from a fresh checkout, which is the same proof continuously rather than once |

CI is the standing version of this whole table: `.github/workflows/ci.yml` checks out clean, runs
`npm ci`, replays the migrations, seeds, builds and runs the gates on every push. A clean-clone
regression fails there before anybody clones anything.

## Media inventory

250 Higgsfield assets (224 images, 26 videos) already exist and are catalogued in
`data/higgsfield/asset-manifest.json`. Rebuild the manifest from the raw generation history with:

```bash
python3 scripts/media/build-higgsfield-manifest.py
```

Nothing already in the manifest may be regenerated — see the asset-priority rule in
[`CLAUDE.md`](CLAUDE.md).
