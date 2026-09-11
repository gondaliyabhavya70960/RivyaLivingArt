/**
 * The one-emitter rule — Phase 39. `components/patterns/JsonLd/index.tsx` is the only file that
 * may write `application/ld+json`; every builder returns an object and every route hands its graph
 * to that component. A second emitter is a second place a forbidden key could reach a crawler
 * without passing `forbiddenKeysIn()` — and, less dramatically, a second `dangerouslySetInnerHTML`
 * on the public site.
 *
 * WALKED BY DIRECTORY, LIKE THE RESEARCH ISOLATION GATE: `app/`, `components/` and `lib/` in full,
 * with the emitter itself, tests, and this script's own directory exempt. Comments and strings are
 * NOT stripped — a string is exactly where `application/ld+json` would appear.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export const EMITTER = join('components', 'patterns', 'JsonLd', 'index.tsx')
const ROOTS = ['app', 'components', 'lib']
/**
 * `lib/scraper/adapters/generic/jsonld.ts` READS structured data from a competitor's page — the
 * selector it uses names the media type, and nothing under lib/scraper renders a byte to a visitor
 * (the research isolation gate proves that). A reader is not an emitter.
 */
const EXEMPT_PREFIXES = [join('lib', 'scraper')]
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs']
const NEEDLE = /application\/ld\+json/

function walk(dir, out) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (EXTENSIONS.some((extension) => name.endsWith(extension))) out.push(full)
  }
  return out
}

/** Every file outside the emitter that mentions the media type, as `path:line`. */
export function findJsonLdEmitters(root) {
  const found = []
  for (const dir of ROOTS) {
    for (const file of walk(join(root, dir), [])) {
      const rel = relative(root, file)
      if (rel === EMITTER) continue
      if (EXEMPT_PREFIXES.some((prefix) => rel.startsWith(prefix))) continue
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (NEEDLE.test(line)) found.push(`${rel}:${String(index + 1)}`)
      })
    }
  }
  return found
}
