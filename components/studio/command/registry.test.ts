import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  PROVIDER_BUDGET_MS,
  RESULTS_PER_PROVIDER,
  registerCommandProvider,
  registeredProviders,
  resetCommandProviders,
  runProviders,
  type CommandResult,
} from './registry'
import { searchRoutes } from './route-provider'
import { ROLE_PERMISSIONS } from '@/lib/auth/permissions'

/**
 * The palette's two jobs: never leak, never hang.
 *
 * Both failures are quiet. A provider that returns results a role may not see leaks record NAMES
 * into a dropdown — worse than a 403, because nothing refuses and nobody notices. A provider that
 * hangs makes the whole palette feel broken with nothing pointing at which one.
 */

const result = (id: string): CommandResult => ({
  id,
  label: id,
  href: `/studio/${id}`,
  group: 'Test',
})

afterEach(() => {
  resetCommandProviders()
  vi.useRealTimers()
})

describe('runProviders', () => {
  it('skips a provider whose permission the role lacks, without running it', () => {
    // BEFORE running, not after filtering results: a provider that executes and has its output
    // discarded has already done the query, and a thrown error from it would surface content.
    const search = vi.fn(async () => [result('secret')])
    registerCommandProvider({ id: 'p', permission: 'system.users.manage', search })

    return runProviders('anything', 'viewer').then((outcome) => {
      expect(search).not.toHaveBeenCalled()
      expect(outcome.results).toEqual([])
    })
  })

  it('runs a provider whose permission the role holds', async () => {
    registerCommandProvider({
      id: 'p',
      permission: 'catalog.read',
      search: async () => [result('a')],
    })
    const outcome = await runProviders('a', 'viewer')
    expect(outcome.results.map((r) => r.id)).toEqual(['a'])
  })

  it('returns nothing for an anonymous reader', async () => {
    registerCommandProvider({
      id: 'p',
      permission: 'catalog.read',
      search: async () => [result('a')],
    })
    expect((await runProviders('a', null)).results).toEqual([])
  })

  it('returns nothing for a blank query rather than everything', async () => {
    // The failure this prevents: an empty palette listing every record in the system.
    const search = vi.fn(async () => [result('a')])
    registerCommandProvider({ id: 'p', permission: 'catalog.read', search })

    expect((await runProviders('   ', 'owner')).results).toEqual([])
    expect(search).not.toHaveBeenCalled()
  })

  it('caps a provider that returns too much', async () => {
    registerCommandProvider({
      id: 'greedy',
      permission: 'catalog.read',
      search: async () => Array.from({ length: 500 }, (_, i) => result(`r${i}`)),
    })
    const outcome = await runProviders('r', 'owner')
    expect(outcome.results).toHaveLength(RESULTS_PER_PROVIDER)
  })

  it(
    'does not let one slow provider block the others, and says which was cut off',
    async () => {
      registerCommandProvider({
        id: 'slow',
        permission: 'catalog.read',
        search: (_query, _context, signal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('aborted')))
          }),
      })
      registerCommandProvider({
        id: 'fast',
        permission: 'catalog.read',
        search: async () => [result('quick')],
      })

      const outcome = await runProviders('q', 'owner')

      expect(outcome.results.map((r) => r.id)).toEqual(['quick'])
      expect(outcome.timedOut).toEqual(['slow'])
      expect(outcome.failed).toEqual([])
    },
    PROVIDER_BUDGET_MS * 20,
  )

  it('tells a broken provider apart from a slow one', async () => {
    // One is a performance problem and one is a bug, and a single "something went wrong" list
    // would send whoever investigates to the wrong place.
    registerCommandProvider({
      id: 'broken',
      permission: 'catalog.read',
      search: async () => {
        throw new Error('bad query')
      },
    })
    const outcome = await runProviders('q', 'owner')
    expect(outcome.failed).toEqual(['broken'])
    expect(outcome.timedOut).toEqual([])
  })

  it('replaces a provider registered twice rather than duplicating it', async () => {
    registerCommandProvider({
      id: 'p',
      permission: 'catalog.read',
      search: async () => [result('old')],
    })
    registerCommandProvider({
      id: 'p',
      permission: 'catalog.read',
      search: async () => [result('new')],
    })

    expect(registeredProviders()).toHaveLength(1)
    expect((await runProviders('n', 'owner')).results.map((r) => r.id)).toEqual(['new'])
  })
})

describe('the route provider', () => {
  it('finds a route by its label', () => {
    const found = searchRoutes('journ', ROLE_PERMISSIONS.owner)
    expect(found[0]?.href).toBe('/studio/content/journal')
  })

  it('finds a route by its path, for somebody who knows the URL', () => {
    const found = searchRoutes('catalog/prod', ROLE_PERMISSIONS.owner)
    expect(found.map((r) => r.href)).toContain('/studio/catalog/products')
  })

  it('filters per ROUTE, not per provider', () => {
    // The provider's own permission is `studio.access`, which every role holds. Filtering only on
    // that would put /studio/system/users in a viewer's palette.
    const viewer = searchRoutes('users', ROLE_PERMISSIONS.viewer)
    expect(viewer.map((r) => r.href)).not.toContain('/studio/system/users')

    const owner = searchRoutes('users', ROLE_PERMISSIONS.owner)
    expect(owner.map((r) => r.href)).toContain('/studio/system/users')
  })

  it('shows a viewer the flags register but nothing else in System', () => {
    const found = searchRoutes('/studio/system', ROLE_PERMISSIONS.viewer)
    expect(found.map((r) => r.href)).toEqual(['/studio/system/flags'])
  })

  it('is case-insensitive', () => {
    expect(searchRoutes('JOURNAL', ROLE_PERMISSIONS.owner)[0]?.href).toBe('/studio/content/journal')
  })
})
