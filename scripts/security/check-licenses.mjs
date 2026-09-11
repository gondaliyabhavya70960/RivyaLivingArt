#!/usr/bin/env node
/**
 * NO COPYLEFT LICENCE IN `dependencies` (Phase 41, SECURITY.md §11)
 *
 * A strong copyleft licence — GPL, AGPL, and to a lesser degree LGPL — attaches obligations to
 * whatever it is distributed with. Rivya's site is a closed commercial product for one studio, and
 * a GPL package arriving as a transitive dependency of something innocuous would attach those
 * obligations silently, at install time, with nobody reading a line of it.
 *
 * IT CHECKS `dependencies`, NOT `devDependencies`, and the distinction is the whole rule. A build
 * tool that never ships imposes nothing on what it builds: `gitleaks`, a linter, a test runner and a
 * type checker can be GPL without consequence. A package whose code is in the bundle or in the
 * server runtime is distributed, and its licence travels with it.
 *
 * IT READS `node_modules`, NOT THE LOCKFILE, because the lockfile records versions and not licences,
 * and a licence can change between two versions of the same package. What is installed is what would
 * ship.
 *
 * IT IS NOT LEGAL ADVICE AND DOES NOT PRETEND TO BE. It is a tripwire on a list of well-known SPDX
 * identifiers. A package with no licence field at all is reported too — an unlicensed dependency is
 * "all rights reserved" by default, which is stricter than GPL, and is usually a packaging mistake
 * worth asking about.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

/**
 * Refused in `dependencies`. Matched case-insensitively as substrings of the SPDX expression, so
 * `GPL-3.0-or-later` and `(MIT OR GPL-2.0)` both hit.
 *
 * `LGPL` IS ON THE LIST, which is stricter than the licence strictly requires — dynamic linking is
 * usually permitted. It is here because "usually permitted" is a conversation to have deliberately
 * rather than a default to inherit, and the way to have it is for this gate to fire.
 */
const REFUSED = [
  'AGPL',
  'GPL-2',
  'GPL-3',
  'GPL-1',
  'LGPL',
  'SSPL',
  'CC-BY-NC',
  'BUSL',
  'Commons Clause',
]

/**
 * Permitted despite matching above, each with a reason.
 *
 * Empty today, and it should stay that way. A row here is a decision that a specific package's
 * specific licence is acceptable for a specific reason — never a way to quiet the gate.
 */
const ALLOWED = new Map()

function licenceOf(packageJson) {
  const licence = packageJson.license ?? packageJson.licenses
  if (typeof licence === 'string') return licence
  if (Array.isArray(licence)) {
    return licence.map((entry) => (typeof entry === 'string' ? entry : entry?.type)).join(' OR ')
  }
  if (licence !== null && typeof licence === 'object' && typeof licence.type === 'string') {
    return licence.type
  }
  return null
}

/** Every installed package directory, including one level of scope. */
function installedPackages() {
  const base = join(ROOT, 'node_modules')
  if (!existsSync(base)) return []
  const found = []
  for (const entry of readdirSync(base)) {
    if (entry.startsWith('.')) continue
    const full = join(base, entry)
    if (!statSync(full).isDirectory()) continue
    if (entry.startsWith('@')) {
      for (const scoped of readdirSync(full)) {
        found.push({ name: `${entry}/${scoped}`, dir: join(full, scoped) })
      }
      continue
    }
    found.push({ name: entry, dir: full })
  }
  return found
}

/**
 * The transitive closure of `dependencies`, walked through each package's own `dependencies`.
 *
 * WALKED RATHER THAN ASSUMED, because the risk is exactly the transitive case: nobody installs a GPL
 * package on purpose. A cycle is handled by the visited set; a dependency that is not installed —
 * an optional peer, a platform-specific binary — is skipped rather than reported, because a package
 * that is not there cannot ship.
 */
function runtimeClosure(directNames, byName) {
  const visited = new Set()
  const queue = [...directNames]
  while (queue.length > 0) {
    const name = queue.pop()
    if (name === undefined || visited.has(name)) continue
    visited.add(name)
    const entry = byName.get(name)
    if (entry === undefined) continue
    for (const child of Object.keys(entry.manifest.dependencies ?? {})) queue.push(child)
  }
  return visited
}

const root = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const byName = new Map()
for (const pkg of installedPackages()) {
  const manifestPath = join(pkg.dir, 'package.json')
  if (!existsSync(manifestPath)) continue
  try {
    byName.set(pkg.name, { ...pkg, manifest: JSON.parse(readFileSync(manifestPath, 'utf8')) })
  } catch {
    // A package with an unreadable manifest is a broken install, not a licence finding.
  }
}

const closure = runtimeClosure(Object.keys(root.dependencies ?? {}), byName)

const refused = []
const unlicensed = []

for (const name of closure) {
  const entry = byName.get(name)
  if (entry === undefined) continue
  const licence = licenceOf(entry.manifest)

  if (licence === null || licence === '') {
    unlicensed.push(name)
    continue
  }
  const hit = REFUSED.find((pattern) => licence.toUpperCase().includes(pattern.toUpperCase()))
  if (hit !== undefined && !ALLOWED.has(name)) {
    refused.push({ name, licence, hit })
  }
}

if (refused.length > 0) {
  console.error(`✗ licences: ${String(refused.length)} copyleft package(s) in the runtime closure:`)
  for (const entry of refused) {
    console.error(`    ${entry.name} — ${entry.licence} (matched ${entry.hit})`)
  }
  console.error(
    '\n  These ship with the product, so their obligations travel with it. Replace the package, move\n' +
      '  it to devDependencies if it is only a build tool, or add it to ALLOWED in this script with a\n' +
      '  reason somebody has actually thought about.',
  )
  process.exit(1)
}

console.log(
  `✓ licences: ${String(closure.size)} package(s) in the runtime closure, none under a refused ` +
    `copyleft licence` +
    (unlicensed.length > 0
      ? `; ${String(unlicensed.length)} declare no licence (${unlicensed.slice(0, 5).join(', ')}${unlicensed.length > 5 ? ', …' : ''}) — usually a packaging omission, worth checking`
      : ''),
)
