import next from 'eslint-config-next'

/**
 * Two version pins that look arbitrary and are not — check here before bumping either:
 *
 *   typescript 6.0.3   typescript-eslint has no TS 7 support yet (the new Go compiler
 *                      changed the API). `tsc --noEmit` works fine on 7; eslint does not.
 *   eslint 9.x         eslint-config-next 16.3.4 declares `eslint: >=9.0.0`, and the
 *                      eslint-plugin-react it bundles calls the pre-10 rule-context API
 *                      (contextOrFilename.getFilename), which ESLint 10 removed.
 *
 * eslint-config-next exports a flat-config ARRAY, not a factory, so it is spread.
 */
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'data/**',
      'docs/**',
      'next-env.d.ts',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  ...next,
]

export default config
