#!/usr/bin/env node
/**
 * media:check-decoder — exactly one module may import an image decoder.
 *
 * WHY. Phase 33 hashes images, and hashing needs pixels, and pixels need a decoder. A decoder
 * anywhere near the scraper is the beginning of an image cache: the module that can decode a
 * competitor's bytes is the module that can keep them. So the decode lives in ONE first-party
 * module — `lib/media/hashes.ts` — which never fetches and never writes, and this gate fails the
 * build the moment `sharp` (or any other decoder) is imported anywhere else under lib/, app/,
 * components/ or scripts/.
 *
 * Exported so `tests/unit/similarity-decoder-scope.test.ts` can run it over the tree and over a
 * fixture that must fail.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ALLOWED_DECODER_MODULES = new Set(['lib/media/hashes.ts'])

export const DECODER_PACKAGES = ['sharp', 'jimp', 'jpeg-js', 'pngjs', 'canvas', '@napi-rs/canvas']

const ROOTS = ['lib', 'app', 'components', 'scripts']
const EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js', '.cjs'])

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) yield* walk(full)
    else if ([...EXTENSIONS].some((extension) => entry.endsWith(extension))) yield full
  }
}

const IMPORT_PATTERNS = DECODER_PACKAGES.map(
  (name) =>
    new RegExp(
      `(?:from\\s*['"]${name}['"]|import\\s*\\(\\s*['"]${name}['"]\\s*\\)|require\\s*\\(\\s*['"]${name}['"]\\s*\\))`,
      'u',
    ),
)

/** Strip comments so a doc comment that names the rule is not a violation of it. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1')
}

/**
 * @param {string} root repository root
 * @param {{ files?: string[] }} [options] explicit file list (relative to root) instead of a walk
 * @returns {{ violations: { file: string, decoder: string }[], allowed: string[] }}
 */
export function checkDecoderScope(root, options = {}) {
  const files =
    options.files ??
    ROOTS.flatMap((dir) => {
      try {
        return [...walk(join(root, dir))].map((file) => relative(root, file))
      } catch {
        return []
      }
    })
  const violations = []
  const allowed = []
  for (const file of files) {
    const normalised = file.split('\\').join('/')
    const source = stripComments(readFileSync(join(root, normalised), 'utf8'))
    for (let index = 0; index < DECODER_PACKAGES.length; index += 1) {
      const pattern = IMPORT_PATTERNS[index]
      if (!pattern.test(source)) continue
      const decoder = DECODER_PACKAGES[index]
      if (ALLOWED_DECODER_MODULES.has(normalised)) allowed.push(normalised)
      else violations.push({ file: normalised, decoder })
    }
  }
  return { violations, allowed }
}

function main() {
  const root = process.cwd()
  const { violations, allowed } = checkDecoderScope(root)
  if (violations.length > 0) {
    console.error('✖ image decoder imported outside lib/media/hashes.ts:')
    for (const violation of violations)
      console.error(`    ${violation.file}  (${violation.decoder})`)
    console.error(
      '  The decode of image bytes lives in exactly one first-party module, which never fetches\n' +
        '  and never writes. A decoder anywhere else is the beginning of an image cache.',
    )
    process.exit(1)
  }
  console.log(
    `✓ decoder scope: ${String(allowed.length)} module(s) import an image decoder, all of them allowed (${[...ALLOWED_DECODER_MODULES].join(', ')})`,
  )
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) main()
