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
  // The Playwright harness drives the dev server over 127.0.0.1 rather than localhost, and
  // Next treats that as a cross-origin dev request. Declaring it keeps the e2e log free of
  // a warning that would otherwise train people to ignore dev-server output.
  allowedDevOrigins: ['127.0.0.1'],
}

export default nextConfig
