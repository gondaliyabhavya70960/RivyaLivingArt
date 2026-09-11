/**
 * The direction ↔ products import barrier — Phase 34, an extension of I4.
 *
 * A "create product from brief" button would have to import the direction repository and the
 * products repository into the same module. No module may. This walks the tree and names any
 * that does; `check-research-isolation.mjs` calls it under I4, and
 * `tests/unit/direction-isolation.test.ts` runs it over a fixture that must fail.
 *
 * Comments are stripped before matching, so a doc comment that names the rule is not a violation
 * of it. Only import statements count — a string mentioning the path is not a coupling.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOTS = ['app', 'components', 'lib', 'scripts']
const EXTENSIONS = ['.ts', '.tsx', '.mjs', '.js']

const DIRECTION_REPOSITORY = /from\s*['"][^'"]*repositories\/research\/direction['"]/u
const PRODUCTS_REPOSITORY =
  /from\s*['"][^'"]*repositories\/(products|catalog-admin|catalog)(\.ts)?['"]/u

function* walk(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (EXTENSIONS.some((extension) => entry.endsWith(extension))) yield full
  }
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1')
}

/**
 * @param {string} root
 * @returns {string[]} repository-relative paths of modules importing both repositories
 */
export function findDirectionProductCouplings(root) {
  const found = []
  for (const dir of ROOTS) {
    for (const file of walk(join(root, dir))) {
      const source = stripComments(readFileSync(file, 'utf8'))
      if (DIRECTION_REPOSITORY.test(source) && PRODUCTS_REPOSITORY.test(source)) {
        found.push(relative(root, file).split('\\').join('/'))
      }
    }
  }
  return found.sort()
}
