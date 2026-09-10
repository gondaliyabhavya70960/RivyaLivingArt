import type { SearchHit } from '@/lib/supabase/repositories/search'
import { PUBLIC_ENTITY_TYPES, type PublicEntityType } from '@/lib/supabase/schemas'

import { GROUP_SIZE } from './query'

/**
 * Results, grouped by entity type in a fixed order.
 *
 * THE ORDER IS FIXED AND IS NOT A RANKING. A group order that moved with relevance would rearrange
 * the page between two similar queries, and a reader who found Journal below Portfolio once will
 * look there again. Products first, because the catalogue is what the site is for; Collections and
 * Categories next, because they are the two ways into it; then the two editorial types.
 *
 * THE FALLBACK MATCHES ARE A GROUP OF THEIR OWN, NOT MIXED IN. A trigram hit and an exact hit are
 * ranked by different numbers on different scales, so interleaving them by score would be
 * arithmetic dressed as judgement. They are separated so the interface can say plainly that these
 * are near matches — which is the difference between typo tolerance and a search that has quietly
 * stopped being precise.
 *
 * NOTHING HERE INVENTS COPY. A group's heading is a `global_content` key returned alongside the
 * rows; this module returns the KEY, and the renderer resolves it. A default English label here
 * would be marketing copy inside a library (CLAUDE.md).
 */

export const GROUP_ORDER = PUBLIC_ENTITY_TYPES

export interface SearchGroup {
  readonly entityType: PublicEntityType
  /** The `global_content` UI_LABEL key for this group's heading. Never a literal. */
  readonly headingKey: string
  readonly hits: readonly SearchHit[]
  /** How many the exact pass matched in total, so the group can offer "see all". */
  readonly total: number
}

export interface GroupedResults {
  readonly groups: readonly SearchGroup[]
  /** Near matches, separated. Empty unless the exact pass returned fewer than four rows. */
  readonly similar: readonly SearchHit[]
  readonly exactCount: number
  readonly similarCount: number
}

export function groupHeadingKey(entityType: PublicEntityType): string {
  return `search.group.${entityType}`
}

function isPublicType(value: string): value is PublicEntityType {
  return (PUBLIC_ENTITY_TYPES as readonly string[]).includes(value)
}

/**
 * Split one flat result list into the landing view's groups.
 *
 * `totals` is optional and, when absent, each group reports what it holds. It is passed on the
 * landing view — where each type is queried with its own cap — so the "see all 34" link is honest
 * rather than reporting the ten that fitted.
 */
export function groupResults(
  hits: readonly SearchHit[],
  totals: Partial<Record<PublicEntityType, number>> = {},
  perGroup: number = GROUP_SIZE,
): GroupedResults {
  const exact = hits.filter((hit) => hit.matchMode === 'EXACT')
  const similar = hits.filter((hit) => hit.matchMode === 'SIMILAR')

  const byType = new Map<PublicEntityType, SearchHit[]>()
  for (const hit of exact) {
    if (!isPublicType(hit.entity_type)) continue
    const bucket = byType.get(hit.entity_type)
    if (bucket) bucket.push(hit)
    else byType.set(hit.entity_type, [hit])
  }

  const groups: SearchGroup[] = []
  for (const entityType of GROUP_ORDER) {
    const bucket = byType.get(entityType)
    if (bucket === undefined || bucket.length === 0) continue
    groups.push({
      entityType,
      headingKey: groupHeadingKey(entityType),
      hits: bucket.slice(0, perGroup),
      total: totals[entityType] ?? bucket.length,
    })
  }

  return {
    groups,
    similar,
    exactCount: exact.length,
    similarCount: similar.length,
  }
}

/**
 * The total a result-count announcement uses.
 *
 * NEAR MATCHES ARE COUNTED SEPARATELY AND ANNOUNCED SEPARATELY. "12 results" that silently
 * includes four typo guesses overstates what was found; the live region says both numbers or only
 * the one that is non-zero.
 */
export function resultTotals(grouped: GroupedResults): {
  exact: number
  similar: number
} {
  return { exact: grouped.exactCount, similar: grouped.similarCount }
}
