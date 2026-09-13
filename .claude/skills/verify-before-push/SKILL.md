---
name: verify-before-push
description: Use before every commit and push, and whenever a test fails unexpectedly. Lists what to run, and the three environment traps that make a healthy build look broken.
---

# What to run, and what a failure actually means

## The order

```
npx tsc --noEmit
npm run check                      # 44 gates; exit 0 or it is not ready
npx vitest run --project unit      # ~3,092 tests
npx vitest run --project integration   # needs DATABASE_URL
npm run build
npx playwright test --shard=N/4 --project=w1920 ... --project=w360
```

`content:check-inventory` is CI-only and deliberately **not** in `check`.

Prove a new assertion actually asserts: **reintroduce the bug and watch it fail**, then restore.
An assertion that has never failed has not been tested.

## Three traps that look exactly like product bugs

**1. A stale server serving a deleted build.** A `next start` still bound to :3000 while `.next` was
rebuilt underneath it answers **500 on every JS chunk**. No island hydrates, so only the interactive
specs fail — indistinguishable from a hydration regression. Once it made every control measure 21px
and looked like an accessibility failure.

It survives `pkill -f "next start"` because **the process is named `next-server`**. Worse,
`pgrep -f "next start"` matches the *shell running that command*, so the obvious kill kills your own
shell (exit 1 or 144). Find it properly:

```
ps -eo pid,etimes,cmd | grep "[n]ext-server"
ss -lptn 'sport = :3000'
```

One-minute check: load any page and look for 500s on `/_next/static/chunks/*.js`.

**2. A PostgREST schema cache older than the database.** After `npm run db:reset`, a long-running
`scripts/db/local-rest.mjs` still holds the pre-reset schema. **Reads work and writes fail** — pages
render fully and only the save breaks. CI never meets this because it starts PostgREST *after*
seeding. Restart the shim, and note it **mints new keys**: re-capture
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from its log, then rebuild.

**3. A prerender older than the data.** Most CMS routes are statically prerendered.
`rm -rf .next/cache` does **not** touch `.next/server/app`, and Next reuses existing HTML when no
source file changed. A data-only change is invisible until `rm -rf .next` and a full rebuild.

## Before calling a failure a flake

It is not a flake because it is inconvenient. Re-run once only to confirm a failure that names a
service the diff does not touch, or one that died before any test body ran. A second failure is
real. **Never** skip, disable or quarantine a test to get green.

## Waiting on background work

Do not write `until ! pgrep -f "playwright test"` — that pattern matches the waiter's own command
line, so the loop never exits. Two such loops once ran for over three hours.
