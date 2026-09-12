import { afterEach, describe, expect, it, vi } from 'vitest'

import { prerenderParams } from '../../lib/site/prerender'

/**
 * ROADMAP E9, made mechanical.
 *
 * A database that does not answer at BUILD time used to fail the whole site's deployment, because
 * an unhandled throw inside `generateStaticParams` aborts page-data collection for every route, not
 * just the one that asked. It happened four times, most recently on the merge that was meant to put
 * ten new routes live:
 *
 *     Error: category failed validation: (database): Gateway Timeout
 *     Error: Failed to collect page data for /product/[slug]
 *
 * Two of the five routes already guarded against it, but only for PostgREST's missing-table codes —
 * so a timeout went straight through. These tests pin the behaviour that replaced that predicate,
 * including the part that is easy to lose in a later refactor: it must still be LOUD.
 */

afterEach(() => {
  vi.restoreAllMocks()
})

describe('prerenderParams', () => {
  it('returns what the read returned when the database answers', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const params = await prerenderParams('/product/[slug]', async () =>
      Promise.resolve([{ slug: 'bench-entryway' }, { slug: 'coffee-table-shallow-basin' }]),
    )

    expect(params).toEqual([{ slug: 'bench-entryway' }, { slug: 'coffee-table-shallow-basin' }])
    // A successful build must not carry the warning, or the warning stops meaning anything.
    expect(warn).not.toHaveBeenCalled()
  })

  it('pre-renders nothing rather than throwing, on the exact failure that broke the build', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    // The shape `toRepositoryError` produces for a Gateway Timeout — see lib/supabase/repositories/support.ts.
    const timeout = new Error('category failed validation: (database): Gateway Timeout')

    const params = await prerenderParams('/product/[slug]', async () => Promise.reject(timeout))

    expect(params).toEqual([])
    expect(warn).toHaveBeenCalledOnce()
  })

  it('names the route and the cause, so the fault is discovered rather than hidden', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await prerenderParams('/portfolio/[slug]', async () =>
      Promise.reject(new Error('Gateway Timeout')),
    )

    /*
     * THIS IS THE ASSERTION THAT ANSWERS THE OBJECTION the previous guard was written around:
     * "those are faults nobody should discover from an empty portfolio". They are discovered — by
     * name, in the build log — which is why swallowing broadly is acceptable here and silence
     * would not be.
     */
    const [message] = warn.mock.calls[0] as [string]
    expect(message).toContain('/portfolio/[slug]')
    expect(message).toContain('Gateway Timeout')
  })

  it('tolerates a failure that is not an Error, without masking it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    // A rejected non-Error is rare but real, and `error.message` on it would throw inside the
    // handler — turning the guard itself into the thing that fails the build.
    const params = await prerenderParams('/collections/[slug]', async () =>
      Promise.reject('socket hang up'),
    )

    expect(params).toEqual([])
    expect((warn.mock.calls[0] as [string])[0]).toContain('socket hang up')
  })

  it('does not swallow a synchronous throw either', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    // `createPublicClient()` throws synchronously when an environment variable is missing, before
    // any promise exists — the read callback must be inside the try, not merely awaited by it.
    const params = await prerenderParams('/journal/[slug]', () => {
      throw new Error('Missing required environment variable NEXT_PUBLIC_SUPABASE_URL')
    })

    expect(params).toEqual([])
  })
})
