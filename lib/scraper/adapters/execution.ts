import { GENERIC_ADAPTER_KEY } from '@/lib/scraper/adapters/registry'
import type { SourceAdapter } from '@/lib/scraper/adapters/types'
import { genericAdapter } from './generic'
import { sourceAAdapter } from './source-a'
import { sourceBAdapter } from './source-b'

/**
 * Key → running adapter. The half of the register the drain loop reads and the Studio never sees.
 *
 * THIS IS THE EXECUTION REGISTRY `adapters/registry.ts` PROMISES, and the two exist separately for
 * one reason, which that file states: an adapter registers a DESCRIPTOR there, which is what a
 * picker, a form and a Server Action may read, and an IMPLEMENTATION here, which only
 * `core/run-adapter.ts`, `workflows/extract.ts` and `scripts/research/reextract.ts` ever touch. A
 * picker that imported implementations would drag every adapter's parser — and through it
 * `node-html-parser`, and eventually somebody's HTTP-shaped helper — into a Client Component in
 * order to render four strings.
 *
 * SO THIS MODULE MAY HOLD PARSERS AND `registry.ts` MAY NOT, and the difference is not a matter of
 * taste: nothing in `components/studio/**` imports this file, and nothing ever should. The picker
 * asks the descriptor register what exists; the drain loop asks this one what runs. Keeping the
 * question in two places is what makes the answer cheap in the bundle that has a budget.
 *
 * NO `server-only` MARKER, FOR THE REASON `core/url-patterns.ts` AND `core/source-schema.ts` BOTH
 * RECORD FROM THE OTHER SIDE. The marker resolves to a module that throws outside a Server
 * Component, and this register is also read by `scripts/research/reextract.ts`, which runs under
 * `tsx` with no Next resolution around it. There is nothing here for a marker to protect in any
 * case: `AdapterContext` grants an adapter no client, no secret, no `fetch`, no file system and no
 * clock, so the worst thing this module can put in a bundle is size. What actually keeps it out of
 * one is the split itself.
 *
 * IT REGISTERS AT IMPORT **AND** EXPORTS THE REGISTRATION, which is `registry.ts`'s shape and
 * `lib/bulk/operations/research/index.ts`'s before it. A module's top-level side effect runs once
 * per process, so a suite that calls `resetAdapters()` and then re-imports this module gets an
 * empty register and every assertion after it quietly passes against nothing.
 * `registerBuiltInAdapterImplementations()` is therefore callable, and calling it is how the
 * register is repopulated.
 *
 * A DUPLICATE KEY THROWS, FOR THE REASON IT THROWS IN `registry.ts` AND NOT IN `lib/bulk/registry.ts`.
 * That registry tolerates a duplicate because its Map lives in one module and its registrations
 * live in others, so a dev server re-evaluating one operations file re-registers into a surviving
 * Map — a crash on every hot reload for a mistake a unit test already catches. Here the Map and the
 * built-in registration are in the SAME module, so a re-evaluation replaces both together and a
 * reload cannot produce a duplicate; the only thing that can is two adapters genuinely claiming one
 * key. That must be loud, because the key is provenance: Phase 27 writes `adapter_key` and
 * `adapter_version` onto every `research_raw_items` and `research_product_versions` row, and
 * last-registration-wins would mean rows already stored are attributed to whichever module the
 * bundler happened to evaluate second. Here it is worse than in the descriptor register, because
 * the wrong winner is not a mislabelled dropdown entry — it is a different parser reading a
 * different value off the page.
 *
 * NOTHING HERE CHECKS THAT A DESCRIPTOR EXISTS FOR A REGISTERED IMPLEMENTATION, deliberately. The
 * two registers are cleared and repopulated independently by tests, so a cross-check at
 * registration time would fail on the seam it is meant to police. `tests/unit/adapter-contract.test.ts`
 * walks both and asserts they name the same keys and the same versions, which is where a mismatch
 * is a finding rather than an accident of test ordering.
 */

/** The register itself. Module-level, so it is per process — see the header on the registration. */
const implementations = new Map<string, SourceAdapter>()

/**
 * Add one adapter, or refuse loudly.
 *
 * THE THROW NAMES BOTH VERSIONS BECAUSE THE MESSAGE IS READ IN A STACK TRACE AT IMPORT TIME, with
 * no debugger attached and no clue as to which two modules collided. A key on its own says a
 * duplicate happened; a key with the version already holding it says which of the two got there
 * first, which is the question a reader has next.
 */
export function registerAdapter(adapter: SourceAdapter): void {
  const existing = implementations.get(adapter.key)
  if (existing !== undefined) {
    throw new Error(
      `Adapter key '${adapter.key}' is already registered by version ${existing.version}. ` +
        'An adapter key is provenance written onto every row the adapter produces, so two ' +
        'adapters may not share one.',
    )
  }

  implementations.set(adapter.key, adapter)
}

/**
 * One adapter by key, or `null`.
 *
 * NULL RATHER THAN A THROW, BECAUSE THE CALLER IS DRAINING A QUEUE. `core/run-adapter.ts` asks this
 * about `research_sources.adapter_key`, a value stored possibly months ago and possibly naming an
 * adapter that has since been removed. The honest outcome is a `research_adapter_runs` row with
 * `status = 'FAILED'` for that one source — which is what `0250`'s status allowlist means by
 * FAILED, "the adapter could not be resolved or started at all" — and the rest of the run
 * continuing. A throw here would take the whole tick down for a configuration problem on one
 * source, which is precisely the blast radius FEAT §27 forbids.
 *
 * THE MATCH IS EXACT, as in `getAdapterDescriptor`. `sourceInputSchema.adapterKey` has already
 * trimmed the string and held it to `KEBAB_CASE`; a second normalisation applied on only one of the
 * paths that reach a register drifts from the first the day either changes.
 */
export function getAdapter(key: string): SourceAdapter | null {
  return implementations.get(key) ?? null
}

/**
 * Every registered adapter, `generic` first and the rest by key.
 *
 * THE SAME ORDER `listAdapterDescriptors()` USES, AND THAT AGREEMENT IS THE REASON THIS SORTS AT
 * ALL. `tests/unit/adapter-contract.test.ts` walks both registers together, and two orderings of
 * the same set produce a diff nobody can read. Insertion order here is module evaluation order,
 * which belongs to the bundler and differs between a dev server and a production build.
 *
 * A LIST WITHOUT `generic` IS POSSIBLE AND IS NOT PAPERED OVER: after `resetAdapters()` and before
 * a re-registration this returns whatever is actually registered, because synthesising the missing
 * entry would make the test seam unable to observe that it had cleared anything.
 */
export function listAdapters(): readonly SourceAdapter[] {
  const generic = implementations.get(GENERIC_ADAPTER_KEY)
  const rest = [...implementations.values()]
    .filter((adapter) => adapter.key !== GENERIC_ADAPTER_KEY)
    // `localeCompare`, matching `listAdapterDescriptors` and `registeredOperations` in
    // `lib/bulk/registry.ts`. Adapter keys are kebab-case ASCII, so locale sensitivity cannot reach
    // them; this is a list for a person, not an input to a hash — see `core/content-hash.ts`, which
    // must not use it.
    .sort((a, b) => a.key.localeCompare(b.key))

  return generic === undefined ? rest : [generic, ...rest]
}

/** Test seam. Production never clears the register — see the header. */
export function resetAdapters(): void {
  implementations.clear()
}

/**
 * Register the adapter implementations this repository ships. Called at import, and callable again.
 *
 * THE TWO PLACEHOLDERS ARE REGISTERED, AND REGISTERING THEM IS THE POINT RATHER THAN AN OVERSIGHT.
 * `source-a` and `source-b` are the FEAT §27 folder shape, and their `supports()` returns false
 * unconditionally — so a source cannot be configured to use one by accident, while the shared
 * contract suite in `tests/unit/adapter-contract.test.ts` still runs them through every assertion
 * every adapter must pass. An unregistered placeholder is a placeholder nothing checks, which is
 * how one acquires a `node:fs` import six months later without anybody noticing.
 *
 * IT ASKS THE REGISTER FIRST, PER KEY, and keeps the throw for the mistake worth stopping.
 * `registerAdapter` refuses a duplicate — the key is provenance, written onto every
 * `research_raw_items` and `research_product_versions` row, so two DIFFERENT adapters claiming one
 * key would misattribute rows already stored. But a caller mirroring `loadBulkOperations()` calls
 * the registration because it cannot know whether the module was already evaluated, and punishing
 * that is punishing the one thing this arrangement exists to allow.
 */
export function registerBuiltInAdapterImplementations(): void {
  for (const adapter of [genericAdapter, sourceAAdapter, sourceBAdapter]) {
    if (getAdapter(adapter.key) === null) registerAdapter(adapter)
  }
}

registerBuiltInAdapterImplementations()
