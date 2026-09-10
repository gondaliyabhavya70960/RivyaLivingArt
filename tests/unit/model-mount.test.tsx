import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  ModelViewerMount,
  buildModelViewerCopy,
  dimensionFacts,
} from '@/components/patterns/ModelViewerMount'
import { modelViewerUiSeed } from '@/content/seed/model-viewer-ui'
import type { SiteStrings } from '@/lib/cms/strings'
import type { PublicModel } from '@/lib/supabase/repositories/models'
import type { MediaAsset } from '@/lib/supabase/schemas'

/**
 * The mount (RC-228) as a server render: what it shows, and what it refuses to show, before any
 * client code runs.
 *
 * jsdom has no WebGL, so the island's probe declines and the poster stands alone — which is also
 * the right first paint on a real device: the control appears only once the browser has answered.
 */

function asset(overrides: Partial<MediaAsset>): MediaAsset {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    provider: 'cloudinary',
    resource_type: 'image',
    public_id: 'rivya/models/poster',
    folder: 'rivya/models',
    filename: 'poster.jpg',
    rivya_asset_id: null,
    kind: 'IMAGE',
    alt_text: 'The chair, photographed',
    is_ai_generated: false,
    is_concept: false,
    width: 1600,
    height: 1200,
    aspect_ratio: '4:3',
    duration_s: null,
    uploaded_by: null,
    source: 'USER_UPLOAD',
    title: null,
    caption: null,
    tags: [],
    subject_tags: [],
    mime_type: 'image/jpeg',
    bytes: null,
    checksum: null,
    poster_public_id: null,
    model_format: null,
    file_size_bytes: null,
    poly_count: null,
    texture_count: null,
    model_thumbnail_id: null,
    model_poster_id: null,
    associated_product_id: null,
    associated_project_id: null,
    viewer_settings: {},
    higgsfield_generation_id: null,
    higgsfield_model: null,
    higgsfield_prompt: null,
    manifest_version: null,
    migrated_at: null,
    created_at: '2026-09-10T00:00:00.000Z',
    updated_at: '2026-09-10T00:00:00.000Z',
    updated_by: null,
    status: 'PUBLISHED',
    owner_verification: 'NOT_REQUIRED',
    fact_classification: null,
    published_at: null,
    published_by: null,
    ...overrides,
  } as MediaAsset
}

const poster = asset({})
const model = asset({
  id: '00000000-0000-4000-8000-000000000002',
  resource_type: 'raw',
  public_id: 'rivya/models/chair.glb',
  kind: 'MODEL_3D',
  model_format: 'GLB',
  model_poster_id: poster.id,
  viewer_settings: { exposure: 1.2 },
})
const publicModel: PublicModel = { model, poster, labels: [] }

/** The seeded words, as the site would read them. */
const STRINGS: SiteStrings = new Map(
  modelViewerUiSeed.records.map((record) => [
    `${String(record.fields.group_key)}.${String(record.fields.key)}`,
    String(record.fields.value),
  ]),
)

const base = {
  model: publicModel,
  materials: [],
  dimensions: null,
  title: 'A chair',
  strings: STRINGS,
  cloudName: 'demo',
  enabled: true,
}

describe('ModelViewerMount', () => {
  it('renders nothing when the flag is off', () => {
    const { container } = render(<ModelViewerMount {...base} enabled={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the poster alone when the words are missing', () => {
    const { container } = render(<ModelViewerMount {...base} strings={new Map()} />)
    const mount = container.querySelector('[data-model-mount]')
    expect(mount?.getAttribute('data-model-state')).toBe('poster-only')
    expect(container.querySelector('img')).not.toBeNull()
    expect(container.querySelector('[data-model-island]')).toBeNull()
  })

  it('renders the poster and the island, declined here because jsdom has no WebGL', () => {
    const { container } = render(<ModelViewerMount {...base} />)
    expect(screen.getByRole('img', { name: 'The chair, photographed' })).toBeInTheDocument()
    const island = container.querySelector('[data-model-island]')
    expect(island).not.toBeNull()
    expect(island?.getAttribute('data-model-capability')).toBe('declined')
    expect(island?.getAttribute('data-model-reasons')).toContain('no-webgl')
    // Declined means no control: a button that opens nothing is worse than none.
    expect(container.querySelector('[data-model-inspect]')).toBeNull()
    expect(container.querySelector('canvas')).toBeNull()
  })

  it('names the region from the seeded string', () => {
    render(<ModelViewerMount {...base} />)
    expect(screen.getByRole('region', { name: 'Three-dimensional view' })).toBeInTheDocument()
  })
})

describe('buildModelViewerCopy', () => {
  it('interpolates the title into the canvas name', () => {
    const copy = buildModelViewerCopy(STRINGS, 'A chair')
    expect(copy?.viewerName).toBe('A chair in 3D')
    expect(copy?.lightingPresets['low-key']).toBe('Low key')
    expect(copy?.environmentPresets['warm-interior']).toBe('Warm interior')
  })

  it('is null when any name the viewer cannot do without is missing', () => {
    const without = new Map(STRINGS)
    without.delete('UI_LABEL.model.reset')
    expect(buildModelViewerCopy(without, 'A chair')).toBeNull()
  })
})

describe('dimensionFacts', () => {
  it('turns products.dimensions into printable facts, and nothing else', () => {
    expect(dimensionFacts({ length_mm: 1800, seats: 6 })).toEqual([
      { key: 'length_mm', value: 1800, unit: 'mm' },
      { key: 'seats', value: 6, unit: null },
    ])
    expect(dimensionFacts(null)).toEqual([])
    expect(dimensionFacts({ bounding_box: [1, 2, 3] })).toEqual([])
  })
})
