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
      // Vendored decoders (Phase 21, RC-905/906): third-party Emscripten output, byte-for-byte from
      // three@0.186.0. Not ours to lint, and never edited by hand.
      'public/draco/**',
      'public/basis/**',
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
     *
     * `app/(studio)/studio/(shell)/content/actions.ts` is the case the rule's own message
     * describes: a Server Action that has already called `requirePermission()`. It reaches for the
     * service role only to call the `cms_*` SECURITY DEFINER functions, which are granted to
     * `service_role` alone BECAUSE they carry the media cascade and the deferrable-constraint
     * reorder — logic that must not be reachable with an anon key. Its ordinary reads and writes
     * go through the request-scoped client, so RLS still applies to everything else it does.
     */
    ignores: [
      'app/api/cron/content-schedule/route.ts',
      'app/(studio)/studio/(shell)/content/actions.ts',
    ],
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
   *   lib/security/rate-limit.ts  `consume_rate_limit()` is granted to `service_role` alone, because
   *                            the bucket key is derived from the caller and an anonymous session
   *                            able to pass any key could exhaust somebody else's window. The one
   *                            caller is an UNAUTHENTICATED public endpoint, so there is no user
   *                            whose permissions could be checked. The seam is one RPC returning a
   *                            boolean.
   *   lib/flags/index.ts       `feature_flags` is shape C — no anon policy, because publishing it
   *                            would hand every visitor the list of features being prepared. Its
   *                            first consumer is a PUBLIC route with no session, so there is no
   *                            user whose permissions could be checked and no client but this one
   *                            that can read the table. The seam is one SELECT and the module
   *                            exports a boolean, never the client.
   *   lib/auth/provisioning.ts creating an `auth.users` row is possible only through GoTrue's admin
   *                            API, which authenticates with the service-role key. Public sign-up
   *                            is disabled at the project level, so an invitation issued here is
   *                            the single route to a Studio account. Kept out of
   *                            `app/(studio)/**` on purpose: a page that renders is a page where a
   *                            service-role client is one careless query away from bypassing RLS on
   *                            something unrelated. Every caller runs
   *                            `withPermission('system.users.manage', …)` first.
   *   lib/bulk/run.ts,         the bulk engine. None of the four bulk tables has an `authenticated`
   *   lib/bulk/undo.ts         insert or update policy (0221), and that is what stops a signed-in
   *                            merchandiser forging a preview carrying a selection nobody
   *                            previewed, or editing the `before` snapshot that undo re-applies —
   *                            writing anything they liked into a live row while the audit log
   *                            recorded a restoration. Every entry point calls
   *                            `requirePermission('bulk.execute')` first, and the engine itself
   *                            re-checks the role, including `destructive.execute`, immediately
   *                            before the first write. Unlike the seams above, these two DO hold a
   *                            client that can reach any table — which is unavoidable for an
   *                            engine that writes products, media and (from Phase 29) research
   *                            rows, and is why the permission check is repeated inside it rather
   *                            than trusted to the caller.
   *   lib/bulk/import/apply.ts, the import and export pipelines, for the same reason as the engine
   *   lib/bulk/export/index.ts  above and one more each. IMPORT writes `products` rows from a file
   *                            and must NOT be able to write `status` or `owner_verification` — an
   *                            allowlist in `bulk-import.ts` enforces that, and a session client
   *                            would add nothing since RLS admits an editor to those columns
   *                            anyway. EXPORT reads enquiries, including — only when the operator
   *                            explicitly ticks the box — the free-text message bodies, which no
   *                            session-scoped read of that table is meant to bulk-extract; the
   *                            caller checks `inquiries.export` and the field list is audited.
   *   lib/search/log.ts        `search_queries` has no write policy for any session role (0212),
   *                            and the reason is the one that keeps recurring here: a PUBLIC search
   *                            has no session, so there is no user whose permissions could be
   *                            checked, and the only alternative to the service role is an anon
   *                            INSERT policy — a public endpoint a stranger could fill with
   *                            arbitrary text attributed to searches nobody ran. The seam is two
   *                            functions that return void and never expose the client, so the
   *                            public search page holds no RLS-bypassing client of its own.
   *   scripts/**               operations tooling; runs with DATABASE_URL and no user session
   *   tests/**                 exercises RLS by comparing an anon client against a privileged one
   */
  {
    files: [
      'lib/supabase/admin.ts',
      'lib/auth/audit.ts',
      'lib/logging/activity.ts',
      'lib/auth/provisioning.ts',
      'lib/flags/index.ts',
      'lib/security/rate-limit.ts',
      'lib/search/log.ts',
      'lib/bulk/run.ts',
      'lib/bulk/undo.ts',
      'lib/bulk/import/apply.ts',
      'lib/bulk/export/index.ts',
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
