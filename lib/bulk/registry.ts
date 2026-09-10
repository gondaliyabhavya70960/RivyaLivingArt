import type { BulkOperation, BulkTargetEntity } from './types'

/**
 * The register of bulk operations.
 *
 * A REGISTRY RATHER THAN A SWITCH, for the same reason the command palette has one: Phases 24, 29
 * and 35 each add operations, and a switch would make every one of them edit the engine. Here a
 * phase adds a file that calls `registerBulkOperation` and touches nothing else.
 *
 * IT IS ALSO WHAT THE GUARD READS. `scripts/bulk/check-bulk-registry.mjs` walks
 * `lib/bulk/operations/**` and fails the build when an operation omits a `preview`, omits a Zod
 * schema, omits its destructive flag, or performs a mutation outside `run.ts`. A registry that
 * only the engine consulted would be a convention; one a build gate consults is a rule.
 *
 * LAST REGISTRATION WINS rather than throwing, so a module re-evaluated by the dev server's hot
 * reload does not crash the Studio. A duplicate kind is a programming error, and the unit test
 * catches it at build time instead.
 */

const operations = new Map<string, BulkOperation<never>>()

export function registerBulkOperation<TParams>(operation: BulkOperation<TParams>): void {
  operations.set(operation.kind, operation as unknown as BulkOperation<never>)
}

export function registeredOperations(): BulkOperation<never>[] {
  return [...operations.values()].sort((a, b) => a.kind.localeCompare(b.kind))
}

export function operationsFor(target: BulkTargetEntity): BulkOperation<never>[] {
  return registeredOperations().filter((operation) => operation.targetEntity === target)
}

export function findOperation(kind: string): BulkOperation<never> | null {
  return operations.get(kind) ?? null
}

/** True when the operation exists AND this phase implements it. See `available` on the contract. */
export function isAvailable(operation: BulkOperation<never>): boolean {
  return operation.available !== false
}

/** Test seam. Production never clears the register. */
export function resetBulkOperations(): void {
  operations.clear()
}

/**
 * Import every operation module for its registration side effect.
 *
 * ONE PLACE, CALLED BY EVERY ENTRY POINT. Without it a Server Action would answer "no such
 * operation" for a kind that is registered in a module nothing imported — a failure that depends
 * on which page happened to load first, which is the worst kind to debug.
 */
export async function loadBulkOperations(): Promise<void> {
  const [products, media, research] = await Promise.all([
    import('./operations/products'),
    import('./operations/media'),
    import('./operations/research'),
  ])

  /*
   * CALLED, NOT MERELY IMPORTED, and the difference only shows up in a test. A module's top-level
   * side effect runs once per process, so after `resetBulkOperations()` a re-import registers
   * nothing — the register stays empty and every lookup returns null. Each module therefore
   * EXPORTS its registration as well as performing it at load, and this calls the exports. In
   * production the two paths are the same registrations written twice into a Map, which costs
   * nothing; in a test it is the difference between a suite that proves something and one that
   * silently asserts against an empty register.
   */
  products.registerProductOperations()
  media.registerMediaOperations()
  research.registerResearchOperations()
}
