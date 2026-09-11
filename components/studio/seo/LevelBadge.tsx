import { Badge, type BadgeTone } from '@/components/primitives/Badge'
import { t, type StudioStringKey } from '@/components/studio/strings'
import type { SeoLevel } from '@/lib/seo/resolve'

/**
 * The resolution level beside a field — Phase 39. Every tab shows it, so an editor always knows
 * whether they are reading their own words (ENTITY, PATH), a default computed from the page
 * (DERIVED), the site-wide fallback (GLOBAL), or nothing at all (NONE).
 */
const TONE: Readonly<Record<SeoLevel, BadgeTone>> = {
  ENTITY: 'success',
  PATH: 'success',
  DERIVED: 'warning',
  GLOBAL: 'neutral',
  NONE: 'danger',
}

const LABEL: Readonly<Record<SeoLevel, StudioStringKey>> = {
  ENTITY: 'studio.seo.level.entity',
  PATH: 'studio.seo.level.path',
  DERIVED: 'studio.seo.level.derived',
  GLOBAL: 'studio.seo.level.global',
  NONE: 'studio.seo.level.none',
}

export function LevelBadge({ level }: { readonly level: SeoLevel }) {
  return (
    <Badge tone={TONE[level]} data-seo-level={level}>
      {t(LABEL[level])}
    </Badge>
  )
}
