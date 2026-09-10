/**
 * Which extraction adapters exist, what each one claims, and nothing whatever about how one works.
 *
 * PHASE 27 BUILDS THE ADAPTER ARCHITECTURE; THIS FILE IS THE ONE PIECE OF IT PHASE 26 CANNOT WAIT
 * FOR. `research_sources.adapter_key` has existed since migration `0231` with the default
 * `'generic'`, and FEAT §26 field 11 says the chosen key "must resolve in the Phase 27 registry;
 * validated on save". A phase that ships the picker with no registry behind it validates nothing:
 * it stores whatever string the drawer posted and finds out on the first run that no adapter
 * answers to it. So the smallest honest thing lands now — a DESCRIPTOR (key, version, capabilities
 * and a `supports()` predicate) and exactly one entry.
 *
 * A DESCRIPTOR PROMISES THAT THE KEY RESOLVES. IT PROMISES NOTHING ABOUT EXTRACTION. Nothing in
 * this repository can yet read a price, a SKU or a dimension off anybody's page — `lib/scraper/
 * workflows/drain.ts` writes `adapterVersion: null` on every `research_raw_items` row precisely
 * because no adapter has produced one. What a descriptor here supports is a Studio form offering a
 * choice, a server action refusing an unknown key, and an audit row recording which adapter a
 * source was configured for. Reading a descriptor as evidence that the pipeline extracts anything
 * is the one misreading this file exists to prevent, which is why `capabilities` is a declared list
 * rather than an implied "all of them" — see the generic entry.
 *
 * THE DESCRIPTOR SHAPE IS THE SEAM, AND IT IS DELIBERATELY THE SMALLER HALF OF PHASE 27's
 * CONTRACT. That contract — `SourceAdapter`, quoted in the phase document — carries these same four
 * members and adds `discover()` and `extract()`. When it lands, each adapter registers BOTH: a
 * descriptor here, which is what a picker, a form and a server action may read, and an
 * implementation in an execution registry only the drain loop touches. Splitting them is what keeps
 * the adapters out of the Studio bundle — a picker that imported implementations would drag every
 * adapter's parser, and eventually its HTTP-shaped helpers, into a Client Component in order to
 * render four strings. It is also what lets Phase 27 add `source-a` and `source-b` as placeholders
 * whose `supports()` matches nothing without the picker having to know they are empty.
 *
 * PURE, WITH NO I/O AT ALL, FOR THE REASON `core/source-schema.ts` AND `core/url-patterns.ts` BOTH
 * RECORD AT LENGTH. `components/studio/research/SourceForm.tsx` is a Client Component — a drawer
 * whose adapter picker warns the moment somebody pastes a base URL cannot be anything else — and
 * both the create page and the edit page hand it `listAdapterDescriptors()`. A `'server-only'`
 * marker resolves to a module that throws when it reaches a client bundle, so adding one here would
 * make the form unbuildable; the alternative, a second list of adapter keys written for the form,
 * is two answers to "which adapters exist", which is exactly the drift FEAT §26 exists to prevent.
 * There is nothing for the marker to protect: no database handle, no secret, no `fetch`, no clock.
 *
 * IT REGISTERS AT IMPORT **AND** EXPORTS THE REGISTRATION, which is the shape
 * `lib/bulk/operations/research/index.ts` arrived at by writing the test that catches the
 * alternative. A module's top-level side effect runs once per process, so a suite that calls
 * `resetAdapterDescriptors()` and then re-imports this module gets an empty registry and every
 * assertion after it quietly passes against nothing. `registerBuiltInAdapters()` is therefore
 * callable, and calling it is how the registry is repopulated.
 *
 * A DUPLICATE KEY THROWS HERE, WHERE `lib/bulk/registry.ts` LETS THE LAST REGISTRATION WIN, AND THE
 * DIFFERENCE IS NOT AN INCONSISTENCY. That registry tolerates a duplicate because its Map lives in
 * one module and its registrations live in others, so the dev server re-evaluating an operations
 * file alone re-registers into a surviving Map — a crash on every hot reload for a mistake a unit
 * test already catches. Here the Map and the built-in registration are in the SAME module, so a
 * re-evaluation replaces both together and a reload cannot produce a duplicate; the only thing that
 * can is two adapters genuinely claiming one key. That must be loud, because the key is provenance:
 * Phase 27 writes `adapter_key` and `adapter_version` onto every raw item and product version, and
 * last-registration-wins would mean rows already stored are attributed to whichever module the
 * bundler happened to evaluate second.
 */

/**
 * What an adapter says it can do. Phase 27's `AdapterCapability`, declared here because the picker
 * renders it and the picker ships first.
 *
 * `DISCOVER` finds URLs on a page; `EXTRACT` turns a page into a `RawProductDraft`; `PAGINATE`
 * follows a next-page link rather than re-crawling a category. They are three separate claims
 * rather than one "works" flag because a source can be usefully discoverable long before anybody
 * has written the rules that read a product off it — which is precisely the state this phase ships
 * in, and a single flag would have to lie in one direction or the other about it.
 */
export type AdapterCapability = 'DISCOVER' | 'EXTRACT' | 'PAGINATE'

/**
 * The two fields of a source that `supports()` is allowed to see.
 *
 * NARROWER THAN THE ROW ON PURPOSE, AND THE NARROWING IS WHAT MAKES THE PICKER POSSIBLE. Phase
 * 27's contract writes `supports(source: ResearchSource)`, but the create drawer asks the question
 * about a source that does not exist yet: a base URL somebody is halfway through typing, with no
 * id, no slug and no row behind it. A predicate demanding the full row could only be called after
 * the save it is meant to warn before. The narrowing costs nothing in the other direction either —
 * a full `ResearchSource` is assignable to this view, so a Phase 27 adapter written against the row
 * still registers a descriptor here, and a descriptor written here can be called with a whole row.
 *
 * `adapterKey` IS OPTIONAL BECAUSE THE NEW-SOURCE FORM HAS NOT GOT ONE. It is carried at all so
 * that an adapter which wants to answer differently about a source already configured to it can,
 * and so the seam describes as much of the source as Phase 27's contract will; the generic
 * descriptor ignores it entirely. Requiring it would force `app/(studio)/studio/(shell)/research/
 * sources/actions.ts` to invent a key in order to ask whether the key it holds is a good one.
 */
export interface AdapterSourceView {
  readonly baseUrl: string
  readonly adapterKey?: string
}

/**
 * One adapter, as everything outside `lib/scraper/adapters/**` is permitted to know it.
 *
 * `version` IS PROVENANCE RATHER THAN DECORATION. Phase 27 records it on every
 * `research_raw_items` and `research_product_versions` row the adapter produces, so a value that
 * later looks wrong can be traced to the exact rules that read it. It is a string rather than a
 * parsed semver triple because nothing here compares two versions — the registry stores what the
 * adapter says it is and hands it on unaltered, and a comparator nobody calls is a comparator that
 * is wrong the first time somebody does.
 */
export interface AdapterDescriptor {
  readonly key: string
  readonly version: string
  readonly capabilities: readonly AdapterCapability[]
  readonly supports: (source: AdapterSourceView) => boolean
}

/**
 * The key `research_sources.adapter_key` defaults to at the column, in `0231` and again in `0240`'s
 * search document. Exported so that a caller needing "the adapter every source can fall back to"
 * names it rather than repeating the literal — FEAT §26's requirement is that `generic` is always
 * available, and a requirement spelled out in five places is one that gets misspelled in a sixth.
 */
export const GENERIC_ADAPTER_KEY = 'generic'

/**
 * The register itself. Module-level, so it is per process — see the header on why the registration
 * is also exported.
 */
const descriptors = new Map<string, AdapterDescriptor>()

/**
 * Add one adapter's descriptor, or refuse loudly.
 *
 * THE THROW NAMES BOTH VERSIONS BECAUSE THE MESSAGE IS READ IN A STACK TRACE AT IMPORT TIME, with
 * no debugger attached and no clue as to which two modules collided. A key on its own says a
 * duplicate happened; a key with the version already holding it says which of the two got there
 * first, which is the question a reader has next.
 */
export function registerAdapterDescriptor(descriptor: AdapterDescriptor): void {
  const existing = descriptors.get(descriptor.key)
  if (existing !== undefined) {
    throw new Error(
      `Adapter key '${descriptor.key}' is already registered by version ${existing.version}. ` +
        'An adapter key is provenance written onto every row the adapter produces, so two ' +
        'adapters may not share one.',
    )
  }

  descriptors.set(descriptor.key, descriptor)
}

/**
 * Every registered descriptor, `generic` first and the rest by key.
 *
 * NOT INSERTION ORDER, AND THAT IS THE ONLY REASON THIS FUNCTION SORTS AT ALL. Insertion order
 * here is module evaluation order, which belongs to the bundler: the same picker would list its
 * adapters differently between a dev server and a production build, and a list that reorders itself
 * for no reason a person can see is one nobody trusts to be complete.
 *
 * `generic` IS PINNED TO THE TOP RATHER THAN LEFT TO THE SORT because it is the one entry whose
 * position carries meaning. It is always available (FEAT §26), it is what the column defaults to,
 * and it is the answer for a source no vendor adapter claims — so it belongs where somebody
 * scanning the list starts, not wherever the alphabet puts it once Phase 27 has added neighbours.
 *
 * A LIST WITHOUT IT IS POSSIBLE AND IS NOT PAPERED OVER: after `resetAdapterDescriptors()` and
 * before a re-registration, this returns whatever is actually registered. Synthesising the generic
 * entry when it is missing would make the test seam unable to observe that it had cleared anything.
 */
export function listAdapterDescriptors(): readonly AdapterDescriptor[] {
  const generic = descriptors.get(GENERIC_ADAPTER_KEY)
  const rest = [...descriptors.values()]
    .filter((descriptor) => descriptor.key !== GENERIC_ADAPTER_KEY)
    // The same comparator `registeredOperations` in `lib/bulk/registry.ts` uses. Adapter keys are
    // kebab-case ASCII (`KEBAB_CASE` in `core/source-schema.ts`), so locale sensitivity cannot
    // reach them; matching the neighbour costs nothing and keeps one habit in the repository.
    .sort((a, b) => a.key.localeCompare(b.key))

  return generic === undefined ? rest : [generic, ...rest]
}

/**
 * One descriptor by key, or `null`.
 *
 * NULL RATHER THAN A THROW, BECAUSE THE CALLER IS VALIDATING A FORM. The save action asks this
 * about a string that came off an HTTP request and answers a refusal with a field-level message —
 * "That adapter does not exist." next to the picker. A lookup that threw would turn a typo, or a
 * key whose adapter has been removed since the source was configured, into a 500 and an unhandled
 * rejection where the honest outcome is a validation issue.
 *
 * THE MATCH IS EXACT. `sourceInputSchema.adapterKey` has already trimmed the string and held it to
 * `KEBAB_CASE`, so trimming or case-folding here would be a second normalisation rule, applied on
 * only one of the two paths that reach the registry, drifting from the first the day either
 * changes.
 */
export function getAdapterDescriptor(key: string): AdapterDescriptor | null {
  return descriptors.get(key) ?? null
}

/** Test seam. Production never clears the register — see the header. */
export function resetAdapterDescriptors(): void {
  descriptors.clear()
}

/**
 * Whether a base URL is one an adapter could be pointed at at all.
 *
 * IT ANSWERS A NARROWER QUESTION THAN `research_sources_base_url_is_http`, AND THE TWO DISAGREEING
 * ABOUT PLAIN `http://` IS DELIBERATE. That CHECK is Rivya's policy about what may be STORED —
 * https for every real source, with loopback admitted so the tests that prove a request was never
 * made can run against a fixture server that has no certificate. This predicate is one adapter's
 * claim about what it can READ, and http is readable. If it restated the constraint, an operator
 * typing an http URL for a real site would be told "this adapter does not claim to support that
 * website", be sent to the adapter picker, and tick the override — when the actual problem is in
 * the field above and the database is about to refuse the row anyway, with the reason.
 *
 * AN UNPARSEABLE URL IS `false`, NEVER A THROW. `supports()` is called from a Server Action on
 * whatever the drawer posted, and the drawer posts while somebody is still typing: an empty string,
 * a bare host, half a scheme. Throwing would make the picker's warning the loudest failure on the
 * page for the field it is not about.
 */
function hasFetchableScheme(baseUrl: string): boolean {
  try {
    const { protocol } = new URL(baseUrl)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * The one adapter this phase registers.
 *
 * `DISCOVER` ONLY, AND THE ABSENT `EXTRACT` IS THE HONEST PART OF THIS OBJECT. What Phase 25's
 * pass actually does with a fetched page is read its title, its canonical URL and its links — which
 * is discovery, and is genuinely all of it. Claiming `EXTRACT` before Phase 27 writes the extractor
 * would put a capability in the picker that the engine cannot honour: a researcher would configure
 * price, SKU and attribute selectors against an adapter advertising that it reads them, enable the
 * source, and get runs that fetch politely and produce no product data, with nothing anywhere
 * saying why. Phase 27 adds `EXTRACT` in the same commit that adds the extractor, and bumps the
 * version, so the claim and the code arrive together.
 *
 * `supports()` ACCEPTS ANY http(s) SOURCE, WHICH IS FEAT §26's "generic is always available"
 * WRITTEN AS A PREDICATE. There is no site the generic adapter refuses, because there is no site it
 * needs anything special to try; a vendor adapter is the one that gets to be choosy. It still
 * refuses a non-http scheme rather than returning a blanket `true` — an `ftp:` or `mailto:` base
 * URL is not a website this pipeline could read under any adapter, and answering "supported" would
 * make the override tick the only thing standing between that string and a queue of jobs that
 * cannot run.
 */
const genericAdapterDescriptor: AdapterDescriptor = {
  key: GENERIC_ADAPTER_KEY,
  // Phase 27 owns the next bump: a change to what an adapter emits is a version change, because
  // the version is what a stored row is read back against.
  version: '1.0.0',
  capabilities: ['DISCOVER'],
  supports: (source) => hasFetchableScheme(source.baseUrl),
}

/**
 * Register the adapters this repository ships. Called at import, and callable again.
 *
 * THE GUARD IS WHAT LETS THE EXPORT SIT BESIDE THE SIDE EFFECT. `registerAdapterDescriptor` throws
 * on a duplicate key, and a caller mirroring `loadBulkOperations()` — calling the registration
 * because it cannot know whether the module was already evaluated — would otherwise be punished for
 * the one thing that arrangement exists to allow. Asking the registry first keeps the throw for the
 * mistake worth stopping: two DIFFERENT adapters claiming one key. Re-registering the same built-in
 * is not that mistake.
 */
export function registerBuiltInAdapters(): void {
  if (descriptors.get(GENERIC_ADAPTER_KEY) === undefined) {
    registerAdapterDescriptor(genericAdapterDescriptor)
  }
}

registerBuiltInAdapters()
