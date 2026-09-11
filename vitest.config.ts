import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname),
      /**
       * `server-only` resolves to a module that THROWS on import, which is the whole point of the
       * package: it fails the build if server code is pulled into a client bundle. Under Vitest
       * that also means every module carrying the marker — `lib/auth/require.ts`,
       * `lib/auth/session.ts`, `lib/auth/audit.ts` — is unimportable, so the most
       * security-sensitive code in the project was the only code with no unit tests.
       *
       * This points at the package's OWN `empty.js`, not a stub written here. That file is what
       * the `react-server` export condition resolves to, i.e. exactly what Next resolves when the
       * module is used correctly. The alias makes the test runner behave like a server, which is
       * the environment these modules are for.
       *
       * It does not weaken the guarantee. What enforces the boundary in a real build is Next's own
       * resolution plus `npm run security:check-bundle`, which greps the built client output; both
       * still run, and neither consults this file.
       */
      'server-only': resolve(import.meta.dirname, 'node_modules/server-only/empty.js'),
    },
  },
  test: {
    /**
     * COVERAGE, AND THE TWO NUMBERS THAT MEAN SOMETHING — Phase 42.
     *
     * A single percentage across the repository is a number people optimise rather than use: it
     * goes up when somebody tests a formatter and stays flat when nobody tests a publish gate. So
     * there are two thresholds and they say different things.
     *
     * `lib/**` AT 80% IS THE FLOOR, not the goal. It is where the pure logic lives — the price
     * presenter, the rate limiter, the crop resolver, the alt-text rules — and a file there with no
     * test is a file somebody will change without knowing what it promised.
     *
     * 100% BRANCH ON THE CRITICAL LIST IS THE REAL RULE. Every one of those files decides something
     * that cannot be undone: whether an enquiry was saved before a redirect, whether a request is
     * rate-limited, what a role may do, what a text alternative says. An untaken branch in any of
     * them is a decision nobody has ever watched being made.
     *
     * WHAT IS EXCLUDED AND WHY. Components and routes are covered by Playwright rather than by
     * Vitest, and counting them here would report a low number for code that is well tested by a
     * different runner — which is the kind of number that gets a threshold lowered.
     */
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/**/*.test.ts',
        'lib/**/*.test.tsx',
        // Generated from the database; a test would assert the generator, which `db:check-types`
        // already does.
        'lib/supabase/database.types.ts',
        // `.tsx` under lib/ is a rendering surface and belongs to Playwright.
        'lib/**/*.tsx',
      ],
      /*
       * THE NUMBERS ARE WHAT IS MEASURED, NOT WHAT WAS HOPED FOR.
       *
       * The phase document projected 80% statements across `lib/**`. The measured figure on
       * 2026-09-11, with 2,907 unit tests passing, is 47.9% — and setting the threshold to 80
       * anyway would make `npm run test:coverage` fail on every run from the day it was written,
       * which is how a gate stops being run at all (the same argument `scripts/ops/check-env.ts`
       * makes about the preview posture).
       *
       * WHY THE REAL FIGURE IS LOW, AND WHY IT IS NOT 47.9% OF THE PRODUCT BEING UNTESTED. Most of
       * `lib/**` is repositories, Server-Component helpers and page loaders, and they are covered
       * by the suites that can actually reach them: 632 RLS tests against a real database and a
       * Playwright suite against a real browser. Neither is visible to a `--project unit`
       * measurement. Counting them would need a database in the coverage run and a merge across
       * three runners, which is worth doing and is not this phase.
       *
       * 45 IS A RATCHET, NOT A TARGET. It is below today's figure by a small margin, so the gate
       * fails when coverage DROPS — which is the property that protects the code — and the number
       * is raised as it rises. The target remains 80 and is recorded in `docs/ops/TESTING.md` §5
       * with what it would take.
       *
       * THE PER-FILE 100% IS REAL AND IS THE RULE THAT MATTERS. These four are pure functions that
       * decide something irreversible, and every branch in them is executed by a test.
       * `lib/security/rate-limit.ts` is NOT on the list at 100%: its pure half is, and `consume()`
       * builds its own admin client and talks to PostgREST, so the unit project cannot enter it.
       * The figure below is that pure half, measured; the database half is covered by
       * `tests/unit/rls/**`, which this run does not see.
       */
      thresholds: {
        statements: 45,
        'lib/auth/permissions.ts': { branches: 100, statements: 100 },
        'lib/media/alt-text-quality.ts': { branches: 100, statements: 100 },
        'lib/media/crop.ts': { branches: 100, statements: 100 },
        'lib/logging/redact.ts': { branches: 100, statements: 100 },
        'lib/security/rate-limit.ts': { branches: 82, statements: 74 },
      },
    },

    /**
     * TWO PROJECTS, BECAUSE ONE OF THEM SHARES A DATABASE.
     *
     * Everything under `tests/unit/rls/**` talks to the same local PostgreSQL cluster, and each of
     * those files calls `loadFixture` in `beforeAll` — which runs committed DDL and re-inserts the
     * fixture rows outside any transaction. Two of them overlapping means one file's wipe lands in
     * the middle of another's assertions.
     *
     * THE SPLIT IS FOR CLARITY, NOT FOR CORRECTNESS. It was originally introduced as the fix,
     * carrying `fileParallelism: false` on this project — which vitest silently ignores inside a
     * project. `maxWorkers` did not isolate it either, and neither did `fileParallelism` at the
     * root. What actually serialises these files is a PostgreSQL advisory lock taken in `connect`
     * and released in `disconnect`; see the long note on `FIXTURE_LOCK` in
     * `tests/unit/rls/harness.ts`. IN `connect`, NOT IN `loadFixture` — this comment said
     * `loadFixture` and that was the second bug inside the first: `phase08-render.test.tsx` builds
     * its own rows and never calls `loadFixture`, so locking there left the one suite that was
     * actually failing unprotected. The lock holds however the runner schedules anything, so both
     * projects stay parallel and the suite keeps its speed.
     *
     * What the split still buys is a named `|rls|` prefix in the output, so a database failure is
     * distinguishable from a pure one at a glance, and a way to run either half alone.
     */
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./tests/setup/vitest.setup.ts'],
          include: [
            'components/**/*.test.{ts,tsx}',
            'lib/**/*.test.{ts,tsx}',
            'tests/unit/**/*.test.{ts,tsx}',
          ],
          exclude: ['tests/unit/rls/**'],
          css: false,
        },
      },
      {
        extends: true,
        test: {
          name: 'rls',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./tests/setup/vitest.setup.ts'],
          include: ['tests/unit/rls/**/*.test.{ts,tsx}'],
          css: false,
        },
      },
      /**
       * THE THIRD PROJECT, ADDED IN PHASE 42, AND IT IS NOT A SECOND RLS PROJECT.
       *
       * `rls` asks "can this role read this row". `integration` asks the questions that are about
       * the database AS A WHOLE and belong to no single phase: does every table have row security
       * on, does the seed do nothing the second time, do the publish gates refuse what the business
       * rules say they refuse, does the migration set replay from empty and match its ledger.
       *
       * They share the harness — the same advisory lock, so the two projects cannot overlap on one
       * cluster — and they are separate because the reason to run them is different. A change to
       * one phase's policies runs `rls`; a change to a migration, a seed or a gate runs this.
       */
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          globals: true,
          setupFiles: ['./tests/setup/vitest.setup.ts'],
          include: ['tests/integration/**/*.test.ts'],
          css: false,
          // A migration replay and a double seed are not 5-second operations.
          testTimeout: 120_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
})
