import { createHash } from 'node:crypto'

/**
 * The seed content hash.
 *
 * Extracted from the runner so it can be tested directly. It is the mechanism the whole
 * owner-edit rule rests on: if this hash is unstable, every row looks edited and the seed silently
 * stops applying; if it is too coarse, a real edit looks untouched and gets overwritten. Both
 * failures are quiet, which is why they are unit-tested rather than trusted.
 */

export type SeedFieldValue = string | number | boolean | null

/**
 * sha256 over the seedable fields, and nothing else.
 *
 * Keys are sorted, so the hash does not depend on the order a module happened to write its object
 * literal — otherwise swapping two lines in a seed file would look like an owner edit and every
 * row in that module would start being skipped.
 *
 * Values go through JSON, so the number 10 and the string "10" cannot hash alike, and `null` stays
 * distinguishable from a missing key.
 */
export function contentHash(fields: Record<string, unknown>): string {
  const canonical = JSON.stringify(
    Object.keys(fields)
      .sort()
      .map((key) => [key, fields[key] ?? null]),
  )
  return createHash('sha256').update(canonical).digest('hex')
}

/**
 * Re-hash a database row over the same field set, to compare against the stored hash.
 *
 * `pg` returns integers as numbers and text as strings, matching what a seed module writes, so a
 * row nobody has touched hashes identically to the record that created it. That equality is the
 * entire owner-edit test.
 */
export function hashRowSubset(row: Record<string, unknown>, fieldNames: readonly string[]): string {
  const subset: Record<string, unknown> = {}
  for (const name of fieldNames) subset[name] = row[name] ?? null
  return contentHash(subset)
}
