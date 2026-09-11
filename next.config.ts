import type { NextConfig } from 'next'

import { computeBuildInfo } from './scripts/build/build-info.mjs'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  /*
   * Phase 38. What was deployed, computed once here and inlined as a string: commit, branch,
   * build time, environment, the migration files the build saw. `lib/ops/build-info.ts` reads it
   * at request time; nothing runs git on a request and no generated module has to exist before
   * the type-checker runs. Identifiers only — never a variable value.
   */
  env: { RIVYA_BUILD_INFO: JSON.stringify(computeBuildInfo()) },
  /*
   * Phase 38. Two files the Studio's system pages read from disk at request time and the
   * serverless bundle would otherwise not carry: the redacted documentation index (built by
   * `npm run docs:index`) and the Higgsfield manifest the environment page counts (D6: the
   * manifest is the record of truth, never the API).
   */
  outputFileTracingIncludes: {
    '/studio/**': ['./content/docs/index.generated.json', './data/higgsfield/asset-manifest.json'],
  },
  /*
   * Phase 39. Robots directives by route class, as response headers — the layer a crawler reads
   * before it parses anything. `/studio` and `/api` are `noindex, nofollow` on every response
   * (beside the auth redirect and the robots.txt `Disallow`, three independent layers); and on a
   * deployment that is not production, so is everything else. `VERCEL_ENV` is read at build
   * time, which is when Vercel sets it — a preview build carries the header into every response
   * it will ever serve, and a production build never does.
   *
   * IN `next.config.ts` RATHER THAN `proxy.ts`. The proxy matches `/studio` alone and, under
   * amendment A2·b, does exactly two things; a whole-deployment header from there would widen
   * its matcher to every path and spend a function invocation per request on a static string.
   * Headers declared here are applied by the platform in front of the runtime.
   */
  headers() {
    const noindex = { key: 'X-Robots-Tag', value: 'noindex, nofollow' }
    /*
     * PHASE 40: `private, no-store` ON EVERY STUDIO RESPONSE.
     *
     * The caching contract asks for it and, before this phase, Studio answered with no
     * `Cache-Control` header at all — which does not mean "do not cache". It means every
     * intermediary applies its own heuristic, and the heuristic for a 200 with a `Last-Modified`
     * is to keep a copy. A Studio page carries the enquirer names, the draft copy and the research
     * corpus, so a shared cache holding one is a disclosure rather than a performance note.
     *
     * `private` is the half that speaks to proxies and `no-store` the half that speaks to the
     * browser's own disk cache; both are wanted, because the page after a sign-out must not be in
     * either.
     */
    const noStore = { key: 'Cache-Control', value: 'private, no-store' }
    const vercelEnv = process.env['VERCEL_ENV']
    const preview = vercelEnv !== undefined && vercelEnv !== 'production'
    return Promise.resolve([
      { source: '/studio', headers: [noindex, noStore] },
      { source: '/studio/:path*', headers: [noindex, noStore] },
      { source: '/api/:path*', headers: [noindex] },
      ...(preview ? [{ source: '/:path*', headers: [noindex] }] : []),
    ])
  },
  // The Playwright harness drives the dev server over 127.0.0.1 rather than localhost, and
  // Next treats that as a cross-origin dev request. Declaring it keeps the e2e log free of
  // a warning that would otherwise train people to ignore dev-server output.
  allowedDevOrigins: ['127.0.0.1'],
}

export default nextConfig
