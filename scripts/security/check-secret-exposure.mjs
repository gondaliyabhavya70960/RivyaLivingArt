#!/usr/bin/env node
/**
 * THE NEVER-EXPOSE LIST, CHECKED AGAINST THE BUILD (Phase 41, SECURITY.md §4)
 *
 * `check-bundle-secrets.mjs` (Phase 04) covers two names and the shape of a service-role JWT. This
 * generalises it to the WHOLE never-expose list and adds entropy detection, which is what catches a
 * value nobody thought to name.
 *
 * BOTH SCRIPTS STAY. The Phase 04 one is narrow, old, trusted and cheap; this one is broad and will
 * grow. Deleting the narrow one to avoid duplication would mean that a bug introduced here silently
 * removes the check that has been protecting the repository for thirty phases.
 *
 * FOUR DETECTORS, EACH CATCHING SOMETHING THE OTHERS CANNOT:
 *
 *   1. THE VARIABLE NAME. `CLOUDINARY_API_SECRET` appearing in a client chunk means the reference
 *      survived tree-shaking — which is how the value follows on the next build.
 *   2. THE VALUE ITSELF, when the environment supplies one. This is the only detector that catches a
 *      value inlined under a different name, or hard-coded by hand. It is also the only one that
 *      cannot run in CI without the secrets present, so it reports how many values it was able to
 *      check rather than pretending.
 *   3. KEY SHAPES. A PEM block, a `postgres://user:pass@` URL, a Google service-account JSON's
 *      `private_key`, an `sk_`/`AKIA` prefix — literal patterns for things that are secrets whatever
 *      they are called.
 *   4. HIGH-ENTROPY STRINGS beside a suspicious name. Entropy alone is unusable on minified
 *      JavaScript, which is full of hashes and base64 — so this one only fires when a long
 *      high-entropy run sits within a hundred characters of a word like `secret` or `apikey`.
 *
 * NOTHING MATCHED IS EVER PRINTED — not the value, not a prefix, not a length, not a silhouette.
 * A file path, a byte offset and the NAME OF THE RULE are enough to find it, and a build log is not
 * a confidential surface (CLAUDE.md).
 *
 * `.next/static/**` IS A HARD FAILURE; `.next/server/**` IS ADVISORY. A server chunk legitimately
 * contains `process.env.SUPABASE_SERVICE_ROLE_KEY`; a browser chunk never does.
 *
 * THE COUNTER-EXAMPLE. `--self-test` builds a fake chunk containing one planted value per detector
 * and asserts that each fires. A guard nobody has seen fail is a guard nobody knows works, and this
 * one's whole value is that it has never fired.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..')
const STATIC_DIR = join(ROOT, '.next/static')
const SERVER_DIR = join(ROOT, '.next/server')

/**
 * SECURITY.md §4's table, as data. Every server-only name in D8.
 *
 * `SCRAPER_USER_AGENT` IS ABSENT DELIBERATELY. It is server-only and it is not secret — its entire
 * job is to identify Rivya to the sites the research fetcher reads, and it is designed to be seen.
 * Listing it would make this gate fail on a value that is supposed to be public, which is how a
 * gate gets an exception list and then gets ignored.
 */
const NEVER_EXPOSE = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'CLOUDINARY_API_SECRET',
  'CLOUDINARY_API_KEY',
  'GOOGLE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_SHEETS_SPREADSHEET_ID',
  'REVALIDATE_SECRET',
  'CRON_SECRET',
  'IP_HASH_SALT',
  'RATE_LIMIT_SALT',
]

/** Literal shapes that are secrets whatever they are called. */
const SHAPES = [
  { rule: 'pem-private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { rule: 'postgres-url-with-password', pattern: /postgres(?:ql)?:\/\/[^\s:'"]+:[^\s@'"]+@/ },
  { rule: 'google-private-key-field', pattern: /"private_key"\s*:\s*"-----BEGIN/ },
  { rule: 'stripe-style-secret', pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}/ },
  { rule: 'aws-access-key-id', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  // A JWT whose payload names the service role. The Phase 04 script decodes properly; this is the
  // cheap literal form, kept so the two do not depend on each other.
  { rule: 'service-role-jwt', pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\./ },
]

/**
 * An env access immediately before a name: `process.env.X`, `env["X"]`, `env['X']`.
 *
 * Anchored to the END of the preceding window, so only an access that actually touches the name
 * counts — the word "environment" three words earlier does not.
 */
const ENV_ACCESS = /env\s*(?:\.|\[\s*["'])\s*$/i

/** Words whose neighbourhood makes a high-entropy run worth reporting. */
const SUSPICIOUS = /(secret|passwo?rd|api[_-]?key|private[_-]?key|token|credential)/i

/** Shannon entropy per character, in bits. */
function entropy(value) {
  const counts = new Map()
  for (const character of value) counts.set(character, (counts.get(character) ?? 0) + 1)
  let bits = 0
  for (const count of counts.values()) {
    const p = count / value.length
    bits -= p * Math.log2(p)
  }
  return bits
}

/**
 * High-entropy runs of at least 32 characters that sit near a suspicious word.
 *
 * 4.0 BITS PER CHARACTER is the threshold, and it is chosen to be quiet rather than thorough. Base64
 * tops out near 6; English prose sits near 4; a minified identifier table is full of runs above 4.
 * Requiring a suspicious word within a hundred characters is what makes the rule usable at all —
 * without it this detector reports every build.
 */
function entropyFindings(text) {
  const found = []
  for (const match of text.matchAll(/[A-Za-z0-9+/_=-]{32,}/g)) {
    const value = match[0]
    if (entropy(value) < 4.0) continue
    const index = match.index ?? 0
    const context = text.slice(Math.max(0, index - 100), index + value.length + 100)
    if (!SUSPICIOUS.test(context)) continue
    found.push({ rule: 'high-entropy-near-secret-word', offset: index })
  }
  return found
}

/** Every finding in one file. Values are never carried out of this function. */
function scan(text, values) {
  const found = []

  /*
   * THE NAME DETECTOR FIRES ON A REFERENCE, NOT ON A MENTION — and the distinction was found by
   * running this gate for the first time.
   *
   * `process.env.CLOUDINARY_API_SECRET` surviving into a client chunk is a real problem: the
   * reference escaped tree-shaking, and the value follows on the build where the bundler decides to
   * inline it. But `studio.sheets.notConfigured` is a Studio label reading "Set
   * GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SHEETS_SPREADSHEET_ID (see ENVIRONMENT.md)" — copy whose
   * whole purpose is to tell an operator which variable to set, and which D8 permits because a NAME
   * is not a value, a prefix or a length.
   *
   * So a hit counts only when the name is preceded by an ACCESS — `env.` or `env["` immediately
   * before it — which covers `process.env.X`, `env["X"]` and every inlining form seen so far.
   * Matching the bare word `env` nearby was the first attempt and it was wrong for a reason worth
   * recording: the label above contains the word "environment", so a substring test reported the
   * very copy that prompted this refinement. A bare mention is collected as advisory: worth printing
   * at the end, never worth failing on.
   */
  for (const name of NEVER_EXPOSE) {
    let index = text.indexOf(name)
    while (index !== -1) {
      const before = text.slice(Math.max(0, index - 24), index)
      found.push({
        rule: `name:${name}`,
        offset: index,
        mentionOnly: !ENV_ACCESS.test(before),
      })
      index = text.indexOf(name, index + name.length)
    }
  }

  for (const { rule, pattern } of SHAPES) {
    const match = pattern.exec(text)
    if (match !== null) found.push({ rule: `shape:${rule}`, offset: match.index })
  }

  for (const { name, value } of values) {
    const index = text.indexOf(value)
    if (index !== -1) found.push({ rule: `value-of:${name}`, offset: index })
  }

  found.push(...entropyFindings(text))
  return found
}

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    // `.map` files are source maps: they are served, and they carry original source.
    else if (/\.(?:js|mjs|cjs|json|txt|map|css)$/.test(entry)) out.push(full)
  }
  return out
}

/* --- the self test ---------------------------------------------------------------------------- */

if (process.argv.includes('--self-test')) {
  const planted = [
    ['name', 'const a = process.env.CLOUDINARY_API_SECRET'],
    ['shape', 'const k = "-----BEGIN RSA PRIVATE KEY-----"'],
    ['shape', 'const d = "postgresql://rivya:hunter2@db.example.com:5432/x"'],
    ['entropy', 'const apiKey = "Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MEFCQ0RFRkdISUpLTE0="'],
  ]
  const missed = planted.filter(
    ([, sample]) => scan(sample, []).filter((finding) => finding.mentionOnly !== true).length === 0,
  )
  if (missed.length > 0) {
    console.error(
      '✗ secret exposure gate SELF TEST FAILED — these planted samples were not caught:',
    )
    for (const [kind] of missed) console.error(`    ${kind}`)
    process.exit(1)
  }
  // And the other direction: an ordinary minified chunk must not fire.
  const innocuous = 'export const h="a1b2c3d4e5f60718293a4b5c6d7e8f90";function t(){return h}'
  // And the case the first real run found: a Studio label naming a variable for an operator.
  const operatorCopy =
    '{value:"Not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON (see ENVIRONMENT.md)."}'
  const noisy = [innocuous, operatorCopy].flatMap((sample) =>
    scan(sample, []).filter((finding) => finding.mentionOnly !== true),
  )
  if (noisy.length > 0) {
    console.error(
      '✗ secret exposure gate SELF TEST FAILED — an ordinary chunk or an operator-facing label was reported',
    )
    process.exit(1)
  }
  console.log(
    `✓ secret exposure gate self test: all ${String(planted.length)} planted samples caught, ` +
      'an ordinary chunk reported nothing',
  )
  process.exit(0)
}

/* --- the run ---------------------------------------------------------------------------------- */

const staticFiles = walk(STATIC_DIR)
if (staticFiles.length === 0) {
  console.error(
    '✗ secret exposure gate: no build to inspect at .next/static — run `npm run build` first.\n' +
      '  A gate that passes because there is nothing to check is worse than no gate.',
  )
  process.exit(1)
}

/**
 * The values, where the environment has them.
 *
 * REPORTED RATHER THAN ASSUMED. In CI these are usually absent, so detector (2) checks nothing — and
 * the summary says how many values it was able to check, because "0 of 10 values available" and
 * "10 of 10 checked" are very different reassurances and must not print the same line.
 */
const values = NEVER_EXPOSE.map((name) => ({ name, value: process.env[name] }))
  .filter((entry) => typeof entry.value === 'string' && entry.value.length >= 12)
  .map((entry) => ({ name: entry.name, value: entry.value }))

const hard = []
const advisory = []

const mentions = []

for (const file of staticFiles) {
  for (const finding of scan(readFileSync(file, 'utf8'), values)) {
    const entry = { file: relative(ROOT, file), ...finding }
    if (finding.mentionOnly === true) mentions.push(entry)
    else hard.push(entry)
  }
}
for (const file of walk(SERVER_DIR)) {
  for (const finding of scan(readFileSync(file, 'utf8'), values)) {
    advisory.push({ file: relative(ROOT, file), ...finding })
  }
}

if (hard.length > 0) {
  console.error(`✗ secret exposure gate: ${String(hard.length)} finding(s) in .next/static:`)
  for (const finding of hard.slice(0, 40)) {
    console.error(`    ${finding.file} @${String(finding.offset)}  [${finding.rule}]`)
  }
  if (hard.length > 40) console.error(`    … and ${String(hard.length - 40)} more`)
  console.error(
    '\n  These files are served to browsers verbatim. The value is not printed above and must not\n' +
      '  be pasted anywhere while investigating: open the file at the offset locally.',
  )
  process.exit(1)
}

console.log(
  `✓ secret exposure gate: ${String(staticFiles.length)} client file(s) clean against ` +
    `${String(NEVER_EXPOSE.length)} never-expose names, ${String(SHAPES.length)} key shapes and ` +
    `the entropy rule; ${String(values.length)} of ${String(NEVER_EXPOSE.length)} values were ` +
    'present in the environment and checked by value too' +
    (advisory.length > 0
      ? `; ${String(advisory.length)} advisory finding(s) in .next/server (expected: a server chunk may name a server variable)`
      : ''),
)

if (mentions.length > 0) {
  // Printed, never failed on. A name in operator-facing copy is permitted; a name that starts
  // appearing next to an `env` access is not, and that is the case the hard rule catches.
  const names = [...new Set(mentions.map((entry) => entry.rule.replace('name:', '')))]
  console.log(
    `  ${String(mentions.length)} mention(s) of a server variable NAME in client copy, none beside ` +
      `an env access: ${names.join(', ')}. A name is not a value (D8).`,
  )
}
