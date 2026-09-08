import { describe, expect, it } from 'vitest'

import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from '@/lib/auth/permissions'
import {
  TRANSITIONS,
  allowedTransitions,
  canTransition,
  permissionForTransition,
  reachableFrom,
  type ContentStatus,
} from '@/lib/cms/transitions'

/**
 * The status workflow's shape.
 *
 * These assertions are the contract migration 0050's `enforce_status_transition` trigger is
 * generated against. A test that only checked the helpers would pass on a table that had lost an
 * edge; the ones that matter here are the STRUCTURAL claims — no direct publish, every status
 * reachable, no duplicate edge — because those are what a reviewer reads the table for.
 */

const ALL_STATUSES: readonly ContentStatus[] = [
  'DRAFT',
  'REVIEW',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED',
]

describe('the edge set', () => {
  it('has exactly twelve edges', () => {
    // Neither source document's number: PHASE-05-09 lists 8, DATA_MODEL §8.2 lists 11, and the
    // union is 12. If this count changes, amendment A7 and the generated SQL both need revisiting.
    expect(TRANSITIONS).toHaveLength(12)
  })

  it('declares no edge twice', () => {
    const keys = TRANSITIONS.map((t) => `${t.from}->${t.to}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('declares no self-edge', () => {
    // `from === to` is not a transition. Listing one would make an ordinary save look like a
    // status change and demand a permission for editing a published section's typo.
    expect(TRANSITIONS.filter((t) => t.from === t.to)).toEqual([])
  })

  it('names only permissions that exist', () => {
    const known = new Set<Permission>(PERMISSIONS)
    expect(TRANSITIONS.filter((t) => !known.has(t.permission))).toEqual([])
  })

  it('uses only real content statuses', () => {
    const known = new Set<string>(ALL_STATUSES)
    const bad = TRANSITIONS.filter((t) => !known.has(t.from) || !known.has(t.to))
    expect(bad).toEqual([])
  })
})

describe('the structural guarantees', () => {
  it('has no direct edge from DRAFT to PUBLISHED, for anyone', () => {
    // The load-bearing assertion of this file. If this ever passes, a section can reach the public
    // site without being reviewed or approved, and the workflow is decoration.
    expect(canTransition('DRAFT', 'PUBLISHED')).toBe(false)
    expect(permissionForTransition('DRAFT', 'PUBLISHED')).toBeNull()
  })

  it('reaches PUBLISHED only from APPROVED', () => {
    const intoPublished = TRANSITIONS.filter((t) => t.to === 'PUBLISHED')
    expect(intoPublished.map((t) => t.from)).toEqual(['APPROVED'])
  })

  it('lets every status reach DRAFT again, so nothing is a dead end', () => {
    for (const status of ALL_STATUSES) {
      if (status === 'DRAFT') continue
      expect(reachableFrom(status), status).toContain('DRAFT')
    }
  })

  it('lets every non-archived status be archived', () => {
    for (const status of ALL_STATUSES) {
      if (status === 'ARCHIVED') continue
      expect(reachableFrom(status), status).toContain('ARCHIVED')
    }
  })

  it('treats a same-status save as legal and permissionless', () => {
    for (const status of ALL_STATUSES) {
      expect(canTransition(status, status), status).toBe(true)
      expect(permissionForTransition(status, status), status).toBeNull()
    }
  })
})

describe('permission assignment', () => {
  it('guards every edge out of REVIEW with content.review', () => {
    const out = TRANSITIONS.filter((t) => t.from === 'REVIEW')
    expect(out).toHaveLength(3)
    expect(out.every((t) => t.permission === 'content.review')).toBe(true)
  })

  it('guards every edge out of APPROVED and PUBLISHED with content.publish', () => {
    const out = TRANSITIONS.filter((t) => t.from === 'APPROVED' || t.from === 'PUBLISHED')
    expect(out.every((t) => t.permission === 'content.publish')).toBe(true)
  })

  it('never guards a transition with content.verify', () => {
    // content.verify gates the owner_verification flag, not movement between statuses. If it
    // appeared here, an owner would be needed to move a section that asserts nothing.
    expect(TRANSITIONS.filter((t) => t.permission === 'content.verify')).toEqual([])
  })
})

describe('allowedTransitions, as the Studio action bar asks it', () => {
  it('offers a viewer nothing from any status', () => {
    for (const status of ALL_STATUSES) {
      expect(allowedTransitions(status, ROLE_PERMISSIONS.viewer), status).toEqual([])
    }
  })

  it('lets an editor walk a section from DRAFT to PUBLISHED in three steps', () => {
    // Not an endorsement — a finding. The same three roles hold write, review and publish, so one
    // person can take a section live unaided. That is recorded as an owner decision rather than
    // silently designed around; see docs/SESSION-STATE.md.
    const editor = ROLE_PERMISSIONS.editor
    expect(allowedTransitions('DRAFT', editor).map((t) => t.to)).toContain('REVIEW')
    expect(allowedTransitions('REVIEW', editor).map((t) => t.to)).toContain('APPROVED')
    expect(allowedTransitions('APPROVED', editor).map((t) => t.to)).toContain('PUBLISHED')
  })

  it('offers a merchandiser no content edge at all', () => {
    // The role the corrected verification step 3 uses: holds content.read and nothing else here.
    for (const status of ALL_STATUSES) {
      expect(allowedTransitions(status, ROLE_PERMISSIONS.merchandiser), status).toEqual([])
    }
  })

  it('offers the owner every edge from every status', () => {
    for (const status of ALL_STATUSES) {
      expect(allowedTransitions(status, ROLE_PERMISSIONS.owner).length, status).toBe(
        reachableFrom(status).length,
      )
    }
  })
})
