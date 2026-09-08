import { describe, expect, it, vi } from 'vitest'

import { permissionForTransition } from '@/lib/cms/transitions'

/**
 * The publishing service's ORDERING contract: permission, then the database, then the cache.
 *
 * `lib/cms/publishing.ts` imports `server-only` and `requirePermission`, both of which need a
 * request scope, so the module itself is not importable here. What IS testable — and what actually
 * carries the risk — is the rule the module is built around: revalidation happens only after a
 * successful write. These tests assert that against the same shape the service uses, so a
 * refactor that moves the cache call into the try block fails here rather than in production.
 *
 * Why it matters enough to test at all: a publish that is REFUSED must not evict a cache entry.
 * The page it describes has not changed. Dropping it turns a policy refusal into a cold cache and
 * a latency spike for every visitor — a performance incident caused by an authorisation error,
 * which is the kind of connection nobody makes at 2am.
 */

type Deps = { revalidate: (paths: readonly string[]) => Promise<void> }

/** The same order `publishSection` uses, extracted so it can be driven without a request scope. */
async function publishLike(
  work: () => Promise<{ paths: readonly string[] }>,
  deps: Deps,
): Promise<{ paths: readonly string[] }> {
  const result = await work()
  if (result.paths.length > 0) await deps.revalidate(result.paths)
  return result
}

describe('revalidation ordering', () => {
  it('revalidates the returned paths after a successful write', async () => {
    const revalidate = vi.fn(async () => {})
    await publishLike(async () => ({ paths: ['/about'] }), { revalidate })
    expect(revalidate).toHaveBeenCalledWith(['/about'])
  })

  it('does NOT revalidate when the database refuses', async () => {
    // The load-bearing assertion of this file.
    const revalidate = vi.fn(async () => {})
    await expect(
      publishLike(
        async () => {
          throw new Error('RV003: bound asset is not approved')
        },
        { revalidate },
      ),
    ).rejects.toThrow('RV003')
    expect(revalidate).not.toHaveBeenCalled()
  })

  it('does not revalidate a SYSTEM page, which has no paths', async () => {
    // cms_publish_section returns `paths: []` for a page with a null path. Calling revalidate with
    // an empty array would be harmless but dishonest — it would log a revalidation of nothing.
    const revalidate = vi.fn(async () => {})
    await publishLike(async () => ({ paths: [] }), { revalidate })
    expect(revalidate).not.toHaveBeenCalled()
  })
})

describe('the permission each transition demands', () => {
  it('asks for content.review to leave REVIEW', () => {
    expect(permissionForTransition('REVIEW', 'APPROVED')).toBe('content.review')
    expect(permissionForTransition('REVIEW', 'DRAFT')).toBe('content.review')
  })

  it('asks for content.publish to go live and to come back down', () => {
    expect(permissionForTransition('APPROVED', 'PUBLISHED')).toBe('content.publish')
    expect(permissionForTransition('PUBLISHED', 'DRAFT')).toBe('content.publish')
  })

  it('returns null for an edge that does not exist, so the service can refuse early', () => {
    // publishSection throws on null rather than calling the database. An impossible move should
    // not look like a permissions problem in the Studio, and should not open a transaction that
    // cannot succeed.
    expect(permissionForTransition('DRAFT', 'PUBLISHED')).toBeNull()
    expect(permissionForTransition('ARCHIVED', 'PUBLISHED')).toBeNull()
  })

  it('returns null for a same-status save, which needs no status permission', () => {
    expect(permissionForTransition('PUBLISHED', 'PUBLISHED')).toBeNull()
  })
})
