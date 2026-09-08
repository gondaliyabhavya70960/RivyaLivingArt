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
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: [
      'components/**/*.test.{ts,tsx}',
      'lib/**/*.test.{ts,tsx}',
      'tests/unit/**/*.test.{ts,tsx}',
    ],
    css: false,
  },
})
