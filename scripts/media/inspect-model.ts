import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

import { inspectModel } from '../../lib/media/inspect-server'
import { detectModelFormat } from '../../lib/media/model'

/**
 * `npx tsx scripts/media/inspect-model.ts <file.glb|file.gltf>`
 *
 * The same inspection the Studio runs on an upload, from the command line, so a model can be
 * checked against the FEAT §14 ceilings before anyone opens Studio. Prints the report as JSON and
 * exits 1 when the file would be refused. Nothing is uploaded, written or generated.
 */

async function main(): Promise<void> {
  const path = process.argv[2]
  if (path === undefined) {
    console.error('usage: tsx scripts/media/inspect-model.ts <file.glb|file.gltf>')
    process.exit(2)
  }
  const format = detectModelFormat({ filename: basename(path) })
  if (format === null) {
    console.error(`${path}: not a .glb or .gltf file`)
    process.exit(2)
  }
  const bytes = new Uint8Array(await readFile(path))
  const report = await inspectModel(bytes, format)
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}

void main()
