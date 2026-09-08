#!/usr/bin/env node
/**
 * PROVIDER BOUNDARY GATE (Phase 06)
 *
 * D1 puts Cloudinary "behind a `MediaProvider` abstraction", and PHASE-05-09.md §06's deliverables
 * table names `lib/media/providers/cloudinary.ts` as the "Only file importing `cloudinary`".
 *
 * WHY THIS IS A BUILD GATE AND NOT A COMMENT. The failure it prevents is not stylistic. The
 * provider module holds `CLOUDINARY_API_SECRET` and is marked `server-only`; the day a component
 * imports the SDK directly to "just build one URL", either the build breaks in a way somebody
 * silences, or — if they import it in a Server Component that a client boundary later swallows —
 * a secret-holding SDK ends up in a browser bundle. Neither is visible in review of the one-line
 * import that caused it.
 *
 * TWO RULES, because the first alone is not enough:
 *
 *   1. Nothing outside `lib/media/providers/` imports `cloudinary`.
 *   2. Nothing outside `lib/media/` imports a provider module directly — the rest of the product
 *      goes through `getMediaProvider()`. Without this, a page could hold `cloudinaryProvider`
 *      itself and the abstraction would be decorative: swapping providers would still be a search
 *      across the codebase, which is the whole thing D1 is trying to prevent.
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const PROVIDER_DIR = 'lib/media/providers/'
const MEDIA_DIR = 'lib/media/'

/**
 * Every TypeScript source file in the working tree, tracked or not.
 *
 * `--others --exclude-standard` matters: a plain `git ls-files` sees only what is committed, so a
 * brand-new file importing the SDK would pass this gate right up until the commit that added it —
 * which is precisely the review where it should have been caught. `git` rather than a glob so that
 * node_modules, .next and everything else gitignored stays out.
 */
const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '*.ts', '*.tsx'],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean)

if (files.length === 0) {
  console.error('✗ no TypeScript files found — the checks below would be vacuous')
  process.exit(1)
}

// `from 'cloudinary'` or `from "cloudinary/..."`, and the require/dynamic-import forms. Anchored on
// the quote so that a path merely CONTAINING the word — './cloudinary-fixtures' — does not match.
const SDK_IMPORT = /(?:from|import|require)\s*\(?\s*['"]cloudinary(?:\/[^'"]*)?['"]/
const PROVIDER_IMPORT = /(?:from|import|require)\s*\(?\s*['"][^'"]*\/media\/providers\/[^'"]*['"]/

const sdkOffenders = []
const providerOffenders = []

for (const file of files) {
  const source = readFileSync(file, 'utf8')

  if (SDK_IMPORT.test(source) && !file.startsWith(PROVIDER_DIR)) {
    sdkOffenders.push(file)
  }
  // A file inside lib/media/ may reach a provider; the check script itself is exempt because it
  // only ever mentions the path in a string it is searching for.
  if (PROVIDER_IMPORT.test(source) && !file.startsWith(MEDIA_DIR) && !file.startsWith('scripts/')) {
    providerOffenders.push(file)
  }
}

let failed = false

if (sdkOffenders.length > 0) {
  failed = true
  console.error(
    `✗ ${sdkOffenders.length} file(s) import the Cloudinary SDK outside ${PROVIDER_DIR}:\n` +
      sdkOffenders.map((f) => `    ${f}`).join('\n') +
      '\n  The SDK carries the API secret. Use getMediaProvider() for server operations, or\n' +
      '  lib/media/url.ts for a delivery URL — it needs nothing but the public cloud name.',
  )
}

if (providerOffenders.length > 0) {
  failed = true
  console.error(
    `✗ ${providerOffenders.length} file(s) import a provider module directly:\n` +
      providerOffenders.map((f) => `    ${f}`).join('\n') +
      '\n  Import getMediaProvider() from lib/media instead. Naming a provider outside\n' +
      '  lib/media/ makes the abstraction decorative.',
  )
}

// The gate must be able to FAIL, not merely pass. If the provider file stopped importing the SDK
// the first rule would go green while proving nothing — so assert the one legitimate import exists.
const providerSource = readFileSync(`${PROVIDER_DIR}cloudinary.ts`, 'utf8')
if (!SDK_IMPORT.test(providerSource)) {
  failed = true
  console.error(
    `✗ ${PROVIDER_DIR}cloudinary.ts does not import the Cloudinary SDK.\n` +
      '  Either it was renamed, or this gate is now checking a rule nothing can break.',
  )
}
if (!providerSource.startsWith("import 'server-only'")) {
  failed = true
  console.error(
    `✗ ${PROVIDER_DIR}cloudinary.ts does not start with \`import 'server-only'\`.\n` +
      '  That import is what makes a client-side import a build error rather than a convention.',
  )
}

if (failed) process.exit(1)

console.log(
  `✓ provider boundary: the Cloudinary SDK is imported only by ${PROVIDER_DIR}cloudinary.ts, ` +
    `which is server-only; ${files.length} source files checked`,
)
