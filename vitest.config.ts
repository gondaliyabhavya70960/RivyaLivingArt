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
     * those files calls `loadFixture` in `beforeAll` — which DELETES the fixture rows and re-inserts
     * them. Run two such files in parallel workers and one file's reset lands in the middle of the
     * other's assertions: rows vanish under a query that just counted them, and a guard that fired
     * correctly reports a row it can no longer see.
     *
     * That failure is scheduling-dependent, which is the worst kind. The suite was green for weeks
     * and went red the moment two DB-free test files were added, because the extra files changed
     * which workers picked up which RLS file. Nothing about the guards had changed. A suite whose
     * result depends on file count is not evidence of anything, so the fix is structural rather
     * than a retry.
     *
     * `fileParallelism: false` on the `rls` project alone. The other ~85 files are pure and stay
     * parallel, so the fast suite keeps its speed and the database suite becomes deterministic.
     * Isolating per file with a schema or a transaction per worker would also work and would be
     * faster, but it would mean the tests no longer exercise the policies on the real tables — and
     * proving the policies is the entire point of these files.
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
          fileParallelism: false,
          css: false,
        },
      },
    ],
  },
})
