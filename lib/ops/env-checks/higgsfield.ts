import { MANIFEST_PATH, readManifest } from '@/lib/media/manifest'

import type { EnvCheck } from './types'

/** The manifest, from the file — never the Higgsfield API (D6). Presence, version and counts. */
export const EXPECTED_ASSETS = { total: 250, images: 224, videos: 26, families: 24 } as const

export const higgsfield: EnvCheck = {
  id: 'higgsfield',
  requires: [],
  channel: 'MEDIA',
  async probe() {
    let manifest
    try {
      manifest = readManifest(MANIFEST_PATH)
    } catch (error) {
      const code =
        error instanceof Error && /ENOENT/u.test(error.message) ? 'MISSING_FILE' : 'INVALID_FILE'
      return { status: 'UNREACHABLE', code }
    }
    const images = manifest.assets.filter((asset) => asset.type === 'image').length
    const videos = manifest.assets.filter((asset) => asset.type === 'video').length
    const families = new Set(manifest.assets.map((asset) => asset.family)).size
    const intact =
      manifest.assets.length === EXPECTED_ASSETS.total &&
      images === EXPECTED_ASSETS.images &&
      videos === EXPECTED_ASSETS.videos &&
      families === EXPECTED_ASSETS.families
    return {
      status: intact ? 'OK' : 'DEGRADED',
      code: intact ? 'OK' : 'INVALID_FILE',
      detail: {
        manifest_version: manifest.manifest_version,
        total: manifest.assets.length,
        images,
        videos,
        families,
      },
    }
  },
}
