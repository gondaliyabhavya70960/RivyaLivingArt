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
     * root. What actually serialises these files is a PostgreSQL advisory lock taken in
     * `loadFixture` and released in `disconnect`; see the long note on `FIXTURE_LOCK` in
     * `tests/unit/rls/harness.ts`. That holds however the runner decides to schedule anything, so
     * both projects stay parallel and the suite keeps its speed.
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
    ],
  },
})
