import type { Permission } from '@/lib/auth/permissions'
import type { Database } from '@/lib/supabase/database.types'

export type ContentStatus = Database['public']['Enums']['content_status']

/**
 * The content status workflow — the ONE place its edges are written down.
 *
 * FOUR THINGS DERIVE FROM THIS ARRAY and none of them may restate it: the
 * `enforce_status_transition` trigger in migration 0050, the guard inside `cms_publish_section`,
 * `lib/cms/publishing.ts`, and the Studio action bar that decides which buttons a given actor
 * sees. A state machine written twice drifts, and the copy that drifts is always the one nobody
 * reads — here that would be the database's, which is the copy an API caller actually hits.
 * `scripts/cms/gen-transition-sql.ts` emits the SQL from this file and `--check` fails the build
 * when the two disagree.
 *
 * TWELVE EDGES, WHICH IS NEITHER DOCUMENT'S NUMBER. `PHASE-05-09.md` §08 lists eight and
 * `DATA_MODEL.md` §8.2 lists eleven, and neither is a superset of the other — the phase document
 * omits every edge to `ARCHIVED` except from `PUBLISHED`, while the data model omits
 * `APPROVED -> REVIEW`. Taking the union is the conservative reading: each of the four extra edges
 * is a correction an editor will need (a section approved by mistake, a draft abandoned), and
 * refusing them would push people to delete rows instead, which loses the revision history that
 * D5 exists to keep. Recorded as amendment A7.
 *
 * WHAT IS NOT HERE IS THE POINT. There is no edge from `DRAFT` to `PUBLISHED`, for any role. A
 * section reaches the public site only by passing through `REVIEW` and `APPROVED`, so "publish"
 * is never a single click from a blank page — not for an editor, not for the owner, and not for
 * the schedule cron, which obeys this same table.
 */
export type StatusTransition = {
  readonly from: ContentStatus
  readonly to: ContentStatus
  readonly permission: Permission
}

export const TRANSITIONS: readonly StatusTransition[] = [
  // Out of DRAFT. Archiving a draft is `content.write` because nothing has been reviewed yet —
  // there is no editorial decision to protect, only the author's own.
  { from: 'DRAFT', to: 'REVIEW', permission: 'content.write' },
  { from: 'DRAFT', to: 'ARCHIVED', permission: 'content.write' },

  // Out of REVIEW. All three are `content.review`: sending work back, approving it, and abandoning
  // it are the same act of judgement seen from different sides.
  { from: 'REVIEW', to: 'DRAFT', permission: 'content.review' },
  { from: 'REVIEW', to: 'APPROVED', permission: 'content.review' },
  { from: 'REVIEW', to: 'ARCHIVED', permission: 'content.review' },

  // Out of APPROVED. `content.publish` guards all four — including the two that step BACKWARD,
  // because un-approving something is a decision about what may go live, which is the same
  // authority publishing is.
  { from: 'APPROVED', to: 'PUBLISHED', permission: 'content.publish' },
  { from: 'APPROVED', to: 'REVIEW', permission: 'content.publish' },
  { from: 'APPROVED', to: 'DRAFT', permission: 'content.publish' },
  { from: 'APPROVED', to: 'ARCHIVED', permission: 'content.publish' },

  // Out of PUBLISHED. Both are an unpublish, and both leave bound media alone — see
  // `lib/cms/publishing.ts` for why demotion is deliberately asymmetric.
  { from: 'PUBLISHED', to: 'DRAFT', permission: 'content.publish' },
  { from: 'PUBLISHED', to: 'ARCHIVED', permission: 'content.publish' },

  // Out of ARCHIVED. Only back to DRAFT: reviving something goes round the loop again rather than
  // rejoining it wherever it left.
  { from: 'ARCHIVED', to: 'DRAFT', permission: 'content.write' },
]

/**
 * Is this a legal edge at all, regardless of who is asking?
 *
 * `from === to` is NOT a transition and is not listed. A save that does not change status must
 * pass the guard untouched, or every ordinary edit to a published section would be refused.
 */
export function canTransition(from: ContentStatus, to: ContentStatus): boolean {
  if (from === to) return true
  return TRANSITIONS.some((t) => t.from === from && t.to === to)
}

/** The permission an edge requires, or `null` when the edge does not exist. */
export function permissionForTransition(from: ContentStatus, to: ContentStatus): Permission | null {
  if (from === to) return null
  return TRANSITIONS.find((t) => t.from === from && t.to === to)?.permission ?? null
}

/**
 * The edges an actor holding `held` may take from `from` — what the Studio action bar renders.
 *
 * Takes the held set rather than a role so that the Studio, the service layer and a test can all
 * ask the same question without one of them re-deriving role → permissions.
 */
export function allowedTransitions(
  from: ContentStatus,
  held: readonly Permission[],
): readonly StatusTransition[] {
  return TRANSITIONS.filter((t) => t.from === from && held.includes(t.permission))
}

/** Every status reachable from `from` by anyone. Used by the trigger generator. */
export function reachableFrom(from: ContentStatus): readonly ContentStatus[] {
  return TRANSITIONS.filter((t) => t.from === from).map((t) => t.to)
}
