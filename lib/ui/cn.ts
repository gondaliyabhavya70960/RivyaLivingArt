/**
 * Class-name joiner. Deliberately tiny and dependency-free: the design system's
 * variants are resolved through lookup maps in each component, not through a
 * class-merging library, so there is nothing here to de-duplicate.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
