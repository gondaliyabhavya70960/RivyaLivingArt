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
   * Dead bindings fail the build.
   *
   * Added in Phase 05 after an unused import went in unnoticed in the same sitting — which is the
   * whole argument for it: nothing else in the toolchain objects. `tsc` does not (an unused import
   * is legal TypeScript), Prettier does not, and the reader who eventually notices has to work out
   * whether the import was load-bearing before deleting it.
   *
   * It found exactly three across the repository, and one of them mattered: `LAST_OWNER_CODE`, a
   * SQLSTATE constant left behind when the last-owner refusal moved to matching the constraint
   * NAME. Its comment still explained why matching 23514 was safe — reasoning for an approach that
   * had been deliberately replaced, sitting next to the code that replaced it.
   *
   * The base rule rather than the typescript-eslint one: this config pins TypeScript to 6.0.3
   * because typescript-eslint has no TS 7 support, and adding the plugin would tie another
   * dependency to that pin for a rule the base ESLint already provides.
   *
   * `args: 'none'` because a React component signature often names props it does not use in every
   * branch, and `_`-prefixed names are the documented way to say "deliberately unused".
   */
  {
    rules: {
      'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_' }],
    },
  },

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
    /**
     * The allowlist. Each entry is a file with no session to act on behalf of, so the service role
     * is not a shortcut past a refusal — it is the only actor there is.
     *
     * `app/api/cron/content-schedule/route.ts` runs from Vercel Cron with no user and no cookie.
     * It authenticates with `CRON_SECRET` and calls `cms_run_content_schedule`, which is granted
     * to `service_role` alone precisely so a leaked anon key cannot publish content.
     */
    ignores: ['app/api/cron/content-schedule/route.ts'],
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
   *   lib/supabase/admin.ts    defines it
   *   lib/auth/audit.ts        `audit_logs` has no insert policy for `authenticated` at all — by
   *                            design, so no signed-in staff member can write the security log or
   *                            bury their own row in noise. The service role is therefore the only
   *                            writer, and this is the only writer that holds it.
   *   lib/logging/activity.ts  `activity_events` has no insert policy for `authenticated` either,
   *                            and for a sharper reason than the audit log: the feed is readable by
   *                            EVERY staff role, so a staff member who could insert could write
   *                            "editor published X" naming a colleague, into the record their
   *                            colleagues actually read. Only this file writes it. It reads through
   *                            the cookie-bound client, so `activity.read` still governs the feed.
   *   lib/auth/provisioning.ts creating an `auth.users` row is possible only through GoTrue's admin
   *                            API, which authenticates with the service-role key. Public sign-up
   *                            is disabled at the project level, so an invitation issued here is
   *                            the single route to a Studio account. Kept out of
   *                            `app/(studio)/**` on purpose: a page that renders is a page where a
   *                            service-role client is one careless query away from bypassing RLS on
   *                            something unrelated. Every caller runs
   *                            `withPermission('system.users.manage', …)` first.
   *   scripts/**               operations tooling; runs with DATABASE_URL and no user session
   *   tests/**                 exercises RLS by comparing an anon client against a privileged one
   */
  {
    files: [
      'lib/supabase/admin.ts',
      'lib/auth/audit.ts',
      'lib/logging/activity.ts',
      'lib/auth/provisioning.ts',
      'scripts/**',
      'tests/**',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  /**
   * EVERY STUDIO PAGE AUTHORISES IN ITS OWN BODY.
   *
   * `lib/auth/require.ts` says it at length: `proxy.ts` is not authorisation. It redirects an
   * unauthenticated request and knows nothing about which record is being touched, so a page that
   * renders without calling `requirePermission()` or `requireRole()` is relying on a redirect it
   * never saw. RLS would still refuse the query underneath — but only for rows it can reason
   * about, and only after the page has already decided to render.
   *
   * The omission is invisible in review: a Studio page that forgot the call looks exactly like one
   * that did not need it. This rule makes the absence loud.
   *
   * The selector matches the FILE, not a call — `Program` with no matching `CallExpression`
   * anywhere beneath it. `no-restricted-syntax` reports whatever the selector matches, so the
   * report lands on line 1, which is the right place for "this file is missing something".
   */
  {
    files: ['app/(studio)/studio/**/page.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program:not(:has(CallExpression[callee.name=/^require(Permission|Role)$/]))',
          message:
            'A Studio page must authorise server-side: call requirePermission() (preferred) or ' +
            'requireRole() from @/lib/auth/require in the page body. proxy.ts and RLS are the ' +
            'other two layers, not a substitute for this one. The sole exemption is ' +
            'app/(studio)/studio/login/page.tsx, which is listed in eslint.config.mjs.',
        },
      ],
    },
  },

  /**
   * The one unauthenticated Studio route (D4, amendment A2·b). It renders the sign-in form, so it
   * cannot demand a session it exists to create. Every other route under `app/(studio)/studio/**`
   * is covered by the rule above.
   */
  {
    files: ['app/(studio)/studio/login/page.tsx'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
]

export default config
