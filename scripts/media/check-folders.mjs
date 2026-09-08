#!/usr/bin/env node
/**
 * FOLDER GATE (Phase 06)
 *
 * D6: "Cloudinary folders follow the manifest's `cloudinary_folder`." `lib/media/folders.ts` holds
 * that list as a literal, because the sign endpoint needs it synchronously and reading a 250-asset
 * JSON file per upload to answer a yes/no question is the wrong shape.
 *
 * A literal copy of 23 strings is a promise that decays. This asserts the two agree, in BOTH
 * directions: a manifest folder missing from the allowlist means uploads to a real folder are
 * refused; an allowlist entry with no manifest folder means the sign endpoint permits a
 * destination nothing audits — and that one is the security-relevant direction.
 *
 * RESERVED_FOLDERS are excluded from the comparison ON PURPOSE: they are destinations for phases
 * that have not run, so by definition no manifest asset occupies them yet.
 */
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync('data/higgsfield/asset-manifest.json', 'utf8'))
const assets = manifest.assets ?? manifest.items ?? []

if (assets.length === 0) {
  console.error('✗ the manifest contains no assets — the comparison below would be vacuous')
  process.exit(1)
}

const fromManifest = new Set(
  assets.map((asset) => asset.cloudinary_folder).filter((folder) => typeof folder === 'string'),
)

// Read the literal out of the module's source rather than importing it: this is a .mjs script and
// folders.ts is TypeScript. The regex targets the MANIFEST_FOLDERS array specifically, so a later
// edit to RESERVED_FOLDERS cannot silently change what is being compared.
const source = readFileSync('lib/media/folders.ts', 'utf8')
const block = /export const MANIFEST_FOLDERS = \[([\s\S]*?)\] as const/.exec(source)

if (block === null) {
  console.error('✗ could not find MANIFEST_FOLDERS in lib/media/folders.ts — has it been renamed?')
  process.exit(1)
}

const fromCode = new Set([...(block[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]))

const missingFromCode = [...fromManifest].filter((f) => !fromCode.has(f)).sort()
const missingFromManifest = [...fromCode].filter((f) => !fromManifest.has(f)).sort()

if (missingFromCode.length > 0 || missingFromManifest.length > 0) {
  console.error('✗ MANIFEST_FOLDERS and the asset manifest disagree:\n')
  for (const folder of missingFromCode) {
    console.error(`    in the manifest, NOT in the allowlist: ${folder}`)
    console.error('      → uploads to a folder real assets already occupy would be refused')
  }
  for (const folder of missingFromManifest) {
    console.error(`    in the allowlist, NOT in the manifest: ${folder}`)
    console.error('      → the sign endpoint permits a destination nothing audits')
  }
  console.error('\n  Rebuild the manifest, or correct lib/media/folders.ts.\n')
  process.exit(1)
}

console.log(
  `✓ folders: ${fromCode.size} manifest folders match lib/media/folders.ts exactly, ` +
    `across ${assets.length} assets`,
)
