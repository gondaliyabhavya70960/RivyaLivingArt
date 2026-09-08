import { taxonomySeed } from './taxonomy'
import type { SeedModule } from './types'

export type { SeedModule, SeedRecord, SeedableTable } from './types'

/**
 * The seed registry.
 *
 * Phase 09 adds modules HERE and nowhere else. The runner reads this list and knows nothing about
 * any particular module — that is the arrangement that lets website copy change without a change
 * to the machine that writes it.
 *
 * Order matters where one module's rows reference another's. Nothing in Phase 03 does.
 */
export const seedModules: readonly SeedModule[] = [taxonomySeed]

/** Every seed key across every module. Used by the runner's duplicate check. */
export function allSeedKeys(): string[] {
  return seedModules.flatMap((module) => module.records.map((record) => record.seedKey))
}
