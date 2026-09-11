#!/usr/bin/env tsx
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { createClient } from '@supabase/supabase-js'

import { isAllowedFolder } from '../../lib/media/folders'
import type { Database } from '../../lib/supabase/database.types'
import { requiredEnv } from '../../lib/env'
import { publicEnv, serverEnv } from '../../lib/supabase/env'
import { insertMediaAsset } from '../../lib/supabase/repositories/media'

/**
 * `npm run media:register-external -- --asset-id=… --url=… --alt="…" [--kind=IMAGE] [--apply]`
 *
 * THE INTAKE PATH FOR AN IMAGE THE OWNER GENERATED ELSEWHERE — Phase 43, and the owner's own
 * instruction: this project writes PROMPTS rather than calling a generator, the owner makes the
 * picture, uploads it to Cloudinary, and pastes the URL back into
 * `docs/ASSET_GENERATION_PROMPTS.md`. This is what turns that URL into a row.
 *
 * IT REFUSES A URL OUTSIDE THE PROJECT'S OWN CLOUD. A `media_assets` row is a promise that the
 * asset is served from the origin every other image on the site comes from — the one in the
 * content security policy, the one `check-third-party.mjs` allows. A row pointing at somebody
 * else's CDN would render a hotlinked image from an origin the policy blocks, and the failure would
 * look like a broken picture rather than like a bad row.
 *
 * IT REGISTERS `is_ai_generated = true, is_concept = true`, ALWAYS AND WITHOUT A FLAG. That is the
 * whole condition under which generated imagery is honest in this product (D6, D10): a concept
 * asset may illustrate a material or an idea and may never be presented as a photograph of
 * delivered work. A `--not-concept` option would exist only to be used, and the trigger on
 * `product_media` refuses a concept asset against a product in any case.
 *
 * IT DOES NOT TOUCH THE MANIFEST. `data/higgsfield/asset-manifest.json` is the record of the 250
 * Higgsfield generations and only the Python builder writes it (`manifest:verify` re-runs the
 * builder and fails on any diff). An owner-supplied image is not a Higgsfield generation, so it
 * gets a `media_assets` row with `source = 'RENDER'` and no manifest entry — which is also what
 * keeps `media:assert-no-regen` meaningful.
 *
 * A DRY RUN BY DEFAULT. It prints the row it would write; `--apply` writes it.
 */

const ENV_PATH = '.env.local'

const KINDS = ['IMAGE', 'VIDEO'] as const
type Kind = (typeof KINDS)[number]

export interface RegisterOptions {
  readonly assetId: string
  readonly url: string
  readonly alt: string
  readonly kind: Kind
  readonly folder: string
  readonly apply: boolean
}

export type ParsedRegister =
  | { readonly ok: true; readonly value: RegisterOptions }
  | { readonly ok: false; readonly error: string }

export function parseArgs(argv: readonly string[]): ParsedRegister {
  let assetId = ''
  let url = ''
  let alt = ''
  let kind: Kind = 'IMAGE'
  let folder = ''
  let apply = false

  for (const arg of argv) {
    if (arg === '--apply') {
      apply = true
      continue
    }
    if (arg.startsWith('--asset-id=')) {
      assetId = arg.slice('--asset-id='.length)
      continue
    }
    if (arg.startsWith('--url=')) {
      url = arg.slice('--url='.length)
      continue
    }
    if (arg.startsWith('--alt=')) {
      alt = arg.slice('--alt='.length)
      continue
    }
    if (arg.startsWith('--folder=')) {
      folder = arg.slice('--folder='.length)
      continue
    }
    if (arg.startsWith('--kind=')) {
      const value = arg.slice('--kind='.length)
      if (!(KINDS as readonly string[]).includes(value)) {
        return { ok: false, error: `--kind must be IMAGE or VIDEO, not ${value}` }
      }
      kind = value as Kind
      continue
    }
    return { ok: false, error: `Unrecognised argument: ${arg}` }
  }

  if (assetId === '') return { ok: false, error: '--asset-id is required' }
  if (url === '') return { ok: false, error: '--url is required' }
  if (alt.trim() === '') {
    // NOT OPTIONAL, and not defaulted to the asset id. `media_assets_alt_text_present` would refuse
    // an empty one at the constraint; refusing it here names the thing that is missing.
    return {
      ok: false,
      error: '--alt is required: an asset with no text alternative cannot be saved',
    }
  }
  if (folder === '') return { ok: false, error: '--folder is required' }
  if (!isAllowedFolder(folder)) {
    return { ok: false, error: `${folder} is not on the folder allowlist in lib/media/folders.ts` }
  }

  return { ok: true, value: { assetId, url, alt, kind, folder, apply } }
}

/**
 * The public id inside a Cloudinary delivery URL, or null when the URL is not one of ours.
 *
 * PARSED RATHER THAN PATTERN-MATCHED, because the thing being checked is the HOST and the CLOUD
 * NAME, and a regex over a URL is how a lookalike host gets through. `new URL` does the parsing and
 * the two equality checks do the deciding.
 */
export function publicIdFrom(url: string, cloudName: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.host !== 'res.cloudinary.com') return null

  const segments = parsed.pathname.split('/').filter((segment) => segment !== '')
  if (segments[0] !== cloudName) return null

  // cloud / resourceType / 'upload' / [transformations…] / [vNNN] / public/id.ext
  const uploadAt = segments.indexOf('upload')
  if (uploadAt === -1) return null

  const rest = segments.slice(uploadAt + 1).filter((segment) => !/^v\d+$/.test(segment))
  if (rest.length === 0) return null

  // A transformation segment carries a comma or a known prefix; the public id is what remains.
  const idParts = rest.filter((segment) => !/^[a-z]{1,3}_/.test(segment) || segment.includes('/'))
  const joined = (idParts.length > 0 ? idParts : rest).join('/')
  return joined.replace(/\.[a-z0-9]+$/i, '')
}

async function main(): Promise<void> {
  if (existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH)
  const parsed = parseArgs(process.argv.slice(2))
  if (!parsed.ok) {
    console.error(parsed.error)
    process.exit(2)
  }
  const options = parsed.value

  const cloudName = requiredEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME')
  const publicId = publicIdFrom(options.url, cloudName)
  if (publicId === null) {
    console.error(
      `That URL is not a delivery URL for this project's Cloudinary cloud (${cloudName}).\n` +
        'Upload the file to the project cloud first, then paste the URL it gives you. A row\n' +
        "pointing at another origin would render an image the site's own security policy blocks.",
    )
    process.exit(1)
  }

  const row = {
    public_id: publicId,
    folder: options.folder,
    resource_type: options.kind === 'IMAGE' ? ('image' as const) : ('video' as const),
    kind: options.kind,
    source: 'RENDER' as const,
    alt_text: options.alt,
    // Always. See the header: this is the condition that keeps generated imagery honest.
    is_ai_generated: true,
    is_concept: true,
    filename: `${options.assetId.toLowerCase()}`,
    mime_type: options.kind === 'IMAGE' ? 'image/png' : 'video/mp4',
    rivya_asset_id: options.assetId,
  }

  if (!options.apply) {
    console.log('DRY RUN — this row would be written:\n')
    console.log(JSON.stringify(row, null, 2))
    console.log('\nRepeat with --apply to write it.')
    return
  }

  const admin = createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  })

  const asset = await insertMediaAsset(admin, { ...row, uploaded_by: null })
  console.log(
    `✓ ${options.assetId} registered as ${asset.id}.\n` +
      '  It is DRAFT and OWNER_VERIFICATION_REQUIRED: bind it to a slot in the Studio, and write\n' +
      '  its real text alternative there while you can see the picture.',
  )
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
