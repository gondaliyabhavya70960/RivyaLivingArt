import type { AdapterFacts, SourceFacts } from './reads'

/**
 * Why a metric cannot be computed, named — Phase 37.
 *
 * `UNAVAILABLE` IS A FACT WITH A REASON, NEVER A SHRUG. A tile that says "no data" teaches nobody
 * anything; one that says "no enabled adapter captures resin style: no attribute key for it exists
 * in the source schema; sources that would need it: modern-forms, atelier-x" is a work item with
 * its owner attached. The reasons here are the fixed vocabulary; the metric's own floor (fewer than
 * twelve priced rows) is the metric's to state, because only it knows the number.
 *
 * TWO DECLARATIONS ARE READ, NEVER WIDENED. Phase 27's adapter descriptor declares what shape an
 * adapter can produce (`capabilities`), and Phase 26's `research_sources.attribute_extraction`
 * declares which attribute keys a source is configured to look for. A metric that depends on an
 * attribute is available when at least one ENABLED source names the key AND its adapter declares
 * `EXTRACT`. Adding a key is a Phase 26/27 change; this module only reads.
 */

export const RECENT_RUN_DAYS = 30

export interface AttributeNeed {
  /** A key from `ATTRIBUTE_KEYS` in `lib/scraper/core/source-schema.ts`. */
  readonly key: string
  /** The words the reason uses — "materials", "customisation". */
  readonly label: string
}

export interface MetricRequirement {
  /** Tables that must exist. Checked against the managed-table register, not the database. */
  readonly tables: readonly string[]
  /** Attribute keys at least one enabled source must be configured to extract. */
  readonly attributeKeys?: readonly AttributeNeed[]
  /**
   * An attribute NO key exists for yet — resin style, colour, production model. Always
   * unavailable, and the reason says what would have to change and which sources would carry it.
   */
  readonly missingCapability?: string
  /** At least one SUCCEEDED research run in the last `RECENT_RUN_DAYS`. */
  readonly recentRun?: boolean
  /** An ACTIVE scoring model. */
  readonly activeModel?: boolean
}

export interface AvailabilityFacts {
  readonly tables: readonly string[]
  readonly sources: readonly SourceFacts[]
  readonly adapters: readonly AdapterFacts[]
  readonly successfulRunsInWindow: number
  readonly hasActiveModel: boolean
}

export type AvailabilityVerdict =
  { readonly ok: true } | { readonly ok: false; readonly reason: string }

function names(sources: readonly SourceFacts[]): string {
  return sources.length === 0 ? 'none enabled' : sources.map((source) => source.slug).join(', ')
}

function adapterExtracts(adapters: readonly AdapterFacts[], key: string): boolean {
  const adapter = adapters.find((candidate) => candidate.key === key)
  return adapter !== undefined && adapter.capabilities.includes('EXTRACT')
}

export function resolveAvailability(
  requires: MetricRequirement,
  facts: AvailabilityFacts,
): AvailabilityVerdict {
  for (const table of requires.tables) {
    if (!facts.tables.includes(table)) {
      return { ok: false, reason: `table ${table} does not exist yet` }
    }
  }

  const enabled = facts.sources.filter((source) => source.isEnabled)

  if (requires.missingCapability !== undefined) {
    return {
      ok: false,
      reason:
        `no enabled adapter captures ${requires.missingCapability}: no attribute key for it exists ` +
        `in the source schema (a Phase 26/27 change); sources that would need it: ${names(enabled)}`,
    }
  }

  for (const need of requires.attributeKeys ?? []) {
    const capturing = enabled.filter(
      (source) =>
        source.attributeKeys.includes(need.key) &&
        adapterExtracts(facts.adapters, source.adapterKey),
    )
    if (capturing.length === 0) {
      const detail =
        enabled.length === 0
          ? 'no research source is enabled'
          : `none of ${names(enabled)} is configured to extract "${need.key}" under an adapter that declares EXTRACT (Sources → parsing → attributes)`
      return { ok: false, reason: `no enabled adapter captures ${need.label}: ${detail}` }
    }
  }

  if (requires.recentRun === true && facts.successfulRunsInWindow < 1) {
    return {
      ok: false,
      reason: `no successful run in the last ${String(RECENT_RUN_DAYS)} days; sources: ${names(enabled)}`,
    }
  }

  if (requires.activeModel === true && !facts.hasActiveModel) {
    return {
      ok: false,
      reason: 'no ACTIVE scoring model (activate one at /studio/research/opportunities)',
    }
  }

  return { ok: true }
}
