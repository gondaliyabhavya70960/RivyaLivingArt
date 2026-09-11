import { z } from 'zod'

/**
 * `web_vitals_samples` — Phase 40.
 *
 * THIS SCHEMA IS A SECURITY BOUNDARY, NOT A CONVENIENCE. It parses a body that arrives from an
 * anonymous browser over an unauthenticated endpoint, and the thing it is defending is the promise
 * in `0380`: this table carries no identifier and nothing can smuggle one in.
 *
 * `.strict()` IS THE LOAD-BEARING PART. A permissive object schema would drop an unknown key
 * silently, which reads as safe and is not: the row would be clean but the endpoint would have
 * ACCEPTED `{ sessionId: '…' }` without complaint, and the next person to add a column would find
 * the data already arriving. Strict means an extra key is a 400 with a named reason, so a client
 * that tries to send an identifier finds out, loudly, in development.
 * `tests/unit/vitals-payload.test.ts` asserts the rejection for `ip`, `userAgent`, `sessionId`,
 * `userId` and `url` by name.
 */

/** The five metrics `web-vitals` reports and this product acts on. CHECKed in `0380` too. */
export const VITALS_METRICS = ['LCP', 'CLS', 'INP', 'TTFB', 'FCP'] as const
export type VitalsMetric = (typeof VITALS_METRICS)[number]

/** Google's three-band verdict, computed by the library from its own thresholds. */
export const VITALS_RATINGS = ['good', 'needs-improvement', 'poor'] as const
export type VitalsRating = (typeof VITALS_RATINGS)[number]

export const NAV_TYPES = [
  'navigate',
  'reload',
  'back-forward',
  'back-forward-cache',
  'prerender',
  'restore',
] as const
export type NavType = (typeof NAV_TYPES)[number]

/** `navigator.connection.effectiveType`. A bucket the browser already computed, never a bandwidth. */
export const EFFECTIVE_TYPES = ['slow-2g', '2g', '3g', '4g'] as const
export type EffectiveType = (typeof EFFECTIVE_TYPES)[number]

/**
 * `navigator.deviceMemory` collapsed to three.
 *
 * The raw figure is one of a handful of values and is a known fingerprinting surface, so the
 * reporter buckets it before it leaves the browser and the schema will not accept anything else.
 */
export const DEVICE_MEMORY_BUCKETS = ['low', 'medium', 'high'] as const
export type DeviceMemoryBucket = (typeof DEVICE_MEMORY_BUCKETS)[number]

/** Viewport class, never the measured width — the width is narrow enough to help identify a device. */
export const VIEWPORT_BUCKETS = ['mobile', 'tablet', 'desktop'] as const
export type ViewportBucket = (typeof VIEWPORT_BUCKETS)[number]

/**
 * A route PATTERN, in Next's bracket form, and this regex is the same rule as `0380`'s CHECK.
 *
 * `/product/[slug]` is admissible; `/product/teak-console-01` is a resolved path and is refused,
 * as is anything carrying `?` or `#`. The reporter derives the pattern from the app router rather
 * than from `location.pathname`, so a resolved path arriving here means a bug worth a 400.
 */
export const ROUTE_PATTERN = /^\/$|^(\/(\[[a-z][a-z0-9_]*\]|[a-z0-9][a-z0-9-]*))+$/

export const routePatternSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(ROUTE_PATTERN, 'route_pattern must be a route pattern such as /product/[slug]')

/**
 * The beacon body.
 *
 * EVERY OPTIONAL FIELD IS A BUCKET AND EVERY REQUIRED FIELD IS A MEASUREMENT. There is no field
 * here capable of identifying anyone, and `.strict()` means there cannot become one by accident.
 */
export const vitalsSampleSchema = z
  .object({
    route_pattern: routePatternSchema,
    metric: z.enum(VITALS_METRICS),
    // Finite and bounded: `Infinity` and `NaN` serialise to `null` through JSON, but a hand-rolled
    // client can still send a number large enough to poison a p75.
    value: z.number().finite().min(0).max(3_600_000),
    rating: z.enum(VITALS_RATINGS),
    nav_type: z.enum(NAV_TYPES).nullish(),
    effective_type: z.enum(EFFECTIVE_TYPES).nullish(),
    device_memory_bucket: z.enum(DEVICE_MEMORY_BUCKETS).nullish(),
    viewport_bucket: z.enum(VIEWPORT_BUCKETS).nullish(),
  })
  .strict()

export type VitalsSampleInput = z.infer<typeof vitalsSampleSchema>

/**
 * The stored row, parsed on the way out.
 *
 * Read-back validation looks redundant beside the CHECK constraints and is not: it is what makes
 * a row that predates a constraint, or one written by a hand-run `psql`, fail to render rather
 * than render as a figure nobody measured.
 */
export const vitalsRowSchema = z.object({
  id: z.string().uuid(),
  route_pattern: z.string().min(1),
  metric: z.enum(VITALS_METRICS),
  value: z.number().finite(),
  rating: z.enum(VITALS_RATINGS),
  nav_type: z.string().nullable(),
  effective_type: z.string().nullable(),
  device_memory_bucket: z.string().nullable(),
  viewport_bucket: z.string().nullable(),
  occurred_at: z.string(),
})

export type VitalsRow = z.infer<typeof vitalsRowSchema>

/**
 * The keys that must never be accepted, named so a test can assert on them.
 *
 * Kept as data rather than left implicit in `.strict()` because the list is the POINT — a reader
 * of this file should be able to see what the endpoint refuses without reasoning about Zod's
 * default behaviour, and `vitals-payload.test.ts` iterates it.
 */
export const FORBIDDEN_PAYLOAD_KEYS = [
  'ip',
  'ip_hash',
  'ipAddress',
  'userAgent',
  'user_agent',
  'sessionId',
  'session_id',
  'userId',
  'user_id',
  'url',
  'href',
  'pathname',
  'referrer',
  'referer',
  'fingerprint',
  'visitorId',
] as const
