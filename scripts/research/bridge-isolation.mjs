/**
 * The bridge carve-out — Phase 35, amendment A35, an extension of I4.
 *
 * `check-research-isolation.mjs` calls `findBridgeViolations` under I4 and
 * `tests/unit/research-isolation.test.ts` runs it over fixtures that must fail (a second writer,
 * a moved symbol, a wider projection). It lives in its own module for the same reason
 * `direction-isolation.mjs` does: the guard script runs its checks at import time and exits, so a
 * test cannot import it.
 *
 * Comments and strings are stripped before matching, so a doc comment that names the rule is not a
 * violation of it. Only import statements and definitions count.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { stripCommentsAndStrings } from '../db/strip-code.mjs'

export const BRIDGE_FILE = join(
  'app',
  '(studio)',
  'studio',
  '(shell)',
  'research',
  'confirmed',
  'actions.ts',
)
export const BRIDGE_SYMBOL = 'startProductFromConfirmation'
const BRIDGE_READERS = ['getConfirmationForBridge']
const BRIDGE_WRITERS = ['markProductStarted', 'releaseProductStart']
const RESEARCH_REPOSITORY = /repositories\/research(\/|$|['"])/
const CATALOG_WRITE_SOURCE =
  /repositories\/(products|catalog-admin|catalog|bulk-products|bulk-import)(\.ts)?$/
const CATALOG_WRITE_SYMBOL =
  /^(insert|update|create|upsert|delete|remove|set|write|save|publish|archive|restore)[A-Z]/

function namedImportsOf(raw) {
  const found = []
  const pattern = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
  for (const match of raw.matchAll(pattern)) {
    if (match[1] !== undefined) continue
    const names = match[2]
      .split(',')
      .map((entry) =>
        entry
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0]
          .trim(),
      )
      .filter((name) => name !== '')
    found.push({ specifier: match[3], names })
  }
  return found
}

function filesUnder(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...filesUnder(full))
    else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) out.push(full)
  }
  return out
}

export function findBridgeViolations(root) {
  const found = []
  const roots = ['app', 'components', 'lib', 'scripts'].map((dir) => join(root, dir))
  for (const dir of roots) {
    for (const file of filesUnder(dir)) {
      const rel = relative(root, file).split('\\').join('/')
      if (/\.test\.(ts|tsx)$/.test(rel)) continue
      const raw = readFileSync(file, 'utf8')
      const code = stripCommentsAndStrings(raw, { strings: false })
      const imports = namedImportsOf(code)

      const readsResearch = imports.some(({ specifier }) => RESEARCH_REPOSITORY.test(specifier))
      const writesCatalogue =
        imports.some(
          ({ specifier, names }) =>
            CATALOG_WRITE_SOURCE.test(specifier) &&
            names.some((name) => CATALOG_WRITE_SYMBOL.test(name)),
        ) ||
        /\.from\(\s*['"]products['"]\s*\)[\s\S]{0,400}?\.(insert|upsert|update|delete)\s*\(/.test(
          raw,
        )

      if (readsResearch && writesCatalogue && rel !== BRIDGE_FILE) {
        found.push(
          `${rel} — writes products AND imports a research repository; only ${BRIDGE_FILE} may`,
        )
      }

      const defines = new RegExp(
        `(?:async\\s+)?function\\s+${BRIDGE_SYMBOL}\\b|const\\s+${BRIDGE_SYMBOL}\\s*=`,
      ).test(code)
      if (defines && rel !== BRIDGE_FILE) {
        found.push(`${rel} — defines ${BRIDGE_SYMBOL}; it may be defined only in ${BRIDGE_FILE}`)
      }

      if (rel === BRIDGE_FILE) {
        if (!defines) found.push(`${rel} — does not define ${BRIDGE_SYMBOL}`)
        for (const { specifier, names } of imports) {
          if (!RESEARCH_REPOSITORY.test(specifier)) continue
          for (const name of names) {
            if (BRIDGE_READERS.includes(name) || BRIDGE_WRITERS.includes(name)) continue
            found.push(
              `${rel} — imports ${name} from ${specifier}; the bridge may read research only through ${BRIDGE_READERS.join(', ')}`,
            )
          }
        }
      }
    }
  }
  return found.sort()
}
