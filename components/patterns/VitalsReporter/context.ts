/**
 * The four context values a vitals sample carries, each reduced to a bucket before it leaves the
 * browser — Phase 40.
 *
 * SEPARATED FROM THE COMPONENT SO THEY CAN BE TESTED. Each of these reads a browser API that a
 * test can stub, and the reduction each performs is the privacy guarantee — `deviceMemory` and an
 * exact viewport width are both well-known fingerprinting inputs, and the whole value of this file
 * is that neither reaches the network. A rule worth stating is a rule worth asserting, so
 * `tests/unit/vitals-payload.test.ts` drives these directly.
 *
 * EVERY ONE RETURNS `null` WHEN THE BROWSER WILL NOT SAY. A guess would be worse than a gap: the
 * column is nullable precisely so "unreported" and "reported as X" stay distinguishable in the
 * data, and `effective_type` in particular is absent on Safari, which is a large share of exactly
 * the devices this data exists to learn about.
 */

import type {
  DeviceMemoryBucket,
  EffectiveType,
  NavType,
  ViewportBucket,
} from '@/lib/supabase/schemas/vitals'

/*
 * THE VALUES ARE RESTATED HERE RATHER THAN IMPORTED, and `satisfies` is what keeps that honest.
 *
 * Importing the schema module's runtime arrays would pull `zod` into the client bundle of every
 * public route — this file is reached from a `'use client'` component, and the whole point of the
 * phase is that a route's first-load JavaScript is budgeted. A type-only import is erased by the
 * compiler and costs nothing, so the TYPES come from the schema and the VALUES live here.
 *
 * `satisfies readonly NavType[]` then catches the direction that matters: a value listed here that
 * the schema and the database would refuse. The other direction — the schema growing a value this
 * file has not heard of — is harmless, because an unknown value is reported as null rather than
 * sent.
 */
const EFFECTIVE_TYPES = new Set([
  'slow-2g',
  '2g',
  '3g',
  '4g',
] as const satisfies readonly EffectiveType[])

const NAV_TYPES = new Set([
  'navigate',
  'reload',
  'back-forward',
  'back-forward-cache',
  'prerender',
  'restore',
] as const satisfies readonly NavType[])

/** `navigator.connection.effectiveType`, passed through only if it is one of the four known values. */
export function connectionType(
  nav: { connection?: { effectiveType?: string } } | undefined = globalThis.navigator as never,
): EffectiveType | null {
  const value = nav?.connection?.effectiveType
  return value !== undefined && (EFFECTIVE_TYPES as ReadonlySet<string>).has(value)
    ? (value as EffectiveType)
    : null
}

/**
 * `navigator.deviceMemory` in gigabytes, collapsed to three buckets.
 *
 * The raw value is already coarse (0.25, 0.5, 1, 2, 4, 8) and is still narrow enough to be a
 * fingerprinting input when combined with anything else. Three buckets keeps what this data is
 * for — "is the slow tail on low-memory devices?" — and discards the rest.
 */
export function bucketDeviceMemory(
  nav: { deviceMemory?: number } | undefined = globalThis.navigator as never,
): DeviceMemoryBucket | null {
  const gb = nav?.deviceMemory
  if (typeof gb !== 'number' || !Number.isFinite(gb) || gb <= 0) return null
  if (gb <= 2) return 'low'
  if (gb <= 4) return 'medium'
  return 'high'
}

/**
 * The viewport, as a class rather than a width.
 *
 * The two thresholds are the design system's own breakpoints, so a bucket here means the same thing
 * as a bucket in a layout discussion.
 */
export function bucketViewport(
  width: number | undefined = globalThis.innerWidth,
): ViewportBucket | null {
  if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) return null
  if (width < 768) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

/** The library's navigation type, passed through only if the database will accept it. */
export function navigationType(value: string | undefined): NavType | null {
  return value !== undefined && (NAV_TYPES as ReadonlySet<string>).has(value)
    ? (value as NavType)
    : null
}
