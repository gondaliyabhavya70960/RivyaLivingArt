/**
 * The one-way guard for the Sheets integration — Phase 36.
 *
 * RIVYA WRITES A TAB; THE SHEET READS. Nothing under `lib/sheets/` may read cell values back:
 * not `values.get`, not `values:batchGet`, not `includeGridData`, not a GET against a `/values/`
 * range, not a developer-metadata search. The ONE read the writer needs — sheet ids and titles for
 * the atomic swap — is of structure, not cells, and it is the only GET the client makes.
 *
 * Exported for `tests/unit/sheets-no-read.test.ts`, which runs it over a fixture that must fail;
 * `check-no-read.mjs` runs it in `npm run check` and CI.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { stripCommentsAndStrings } from '../db/strip-code.mjs'

export const SHEETS_ROOT = join('lib', 'sheets')

/** Vocabulary of a read of cell values, as the Sheets REST API and its SDKs spell it. */
const READ_PATTERNS = [
  /\bvalues\s*\.\s*get\b/u,
  /\bvalues\s*:\s*batchGet\b/u,
  /\bbatchGet\b/u,
  /\bincludeGridData\b/u,
  /\bdeveloperMetadata\b/u,
  /\bsearchDeveloperMetadata\b/u,
  /\bgetByDataFilter\b/u,
  /['"`]GET['"`][^\n]*\/values\//u,
  /\/values\/[^\n]*['"`]GET['"`]/u,
]

function walk(dir) {
  let out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out = out.concat(walk(full))
    else if (/\.(ts|tsx|mjs|js)$/u.test(entry) && !/\.test\./u.test(entry)) out.push(full)
  }
  return out
}

/**
 * @param {string} root
 * @returns {string[]} `file:line: match` for every read of cell values under lib/sheets
 */
export function findSheetsReads(root) {
  const found = []
  for (const file of walk(join(root, SHEETS_ROOT))) {
    // Strings are KEPT: the offending call is spelled as a URL fragment inside a string.
    const source = stripCommentsAndStrings(readFileSync(file, 'utf8'), { strings: false })
    source.split('\n').forEach((line, index) => {
      for (const pattern of READ_PATTERNS) {
        const match = pattern.exec(line)
        if (match) {
          found.push(
            `${relative(root, file).split('\\').join('/')}:${String(index + 1)}: ${match[0]}`,
          )
          break
        }
      }
    })
  }
  return found.sort()
}
