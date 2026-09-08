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

  /**
   * The service-role client bypasses Row Level Security entirely, so importing it is a decision
   * rather than a convenience. This rule names the small set of files allowed to make it.
   *
   * `lib/supabase/admin.ts` already starts with `import 'server-only'`, which turns a Client
   * Component import into a build error. This is the earlier, louder layer: it fails in the
   * editor, it names the rule, and it also catches a SERVER file that reaches for the admin client
   * to get around an RLS refusal — which `server-only` would happily allow.
   */
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/supabase/admin', '**/supabase/admin.ts', '@/lib/supabase/admin'],
              message:
                'lib/supabase/admin.ts bypasses RLS. Import it only from a server action that has ' +
                'already called requirePermission(), or from a script. Add the file to the ' +
                'allowlist in eslint.config.mjs if it genuinely needs the service role.',
            },
          ],
        },
      ],
    },
  },

  /**
   * The allowlist. Every entry is a file that legitimately holds the service role:
   *   lib/supabase/admin.ts  defines it
   *   scripts/**             operations tooling; runs with DATABASE_URL and no user session
   *   tests/**               exercises RLS by comparing an anon client against a privileged one
   */
  {
    files: ['lib/supabase/admin.ts', 'scripts/**', 'tests/**'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]

export default config
