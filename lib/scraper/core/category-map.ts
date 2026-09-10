/**
 * A source's own category labels, resolved to a Rivya category — or to nothing, which is an answer.
 *
 * THE GOVERNING RULE, AND EVERY DECISION BELOW IS AN APPLICATION OF IT: **AN UNMAPPED SOURCE
 * CATEGORY IS A FIRST-CLASS RESULT, NOT A PROBLEM TO BE SOLVED BY GUESSING.** It is never defaulted
 * to the first category, never to `furniture`, and never inferred from the words in the label.
 * Phase 28 leaves such a row unmatched, the dashboard counts it, and that count is the whole point:
 * a gap somebody can close by typing one mapping. A module that guessed would replace a visible,
 * closable gap with an invisible, wrong answer — and Phase 31 charts what Phase 28 matched, so the
 * guess would arrive at the owner as a fact about a market.
 *
 * PURE, AND WITH NO I/O AT ALL. Everything here takes strings and rows and returns strings and
 * rows. Nothing fetches, nothing reads a database, nothing consults a clock. The mapping rows are
 * read by `lib/supabase/repositories/research/**` and passed in; that is what makes the resolution
 * rules — which are exactly the rules that must not drift — testable as a table of cases.
 *
 * THE THREE STATES A MAPPING ROW CAN BE IN COME FROM THE TABLE, NOT FROM HERE. Migration `0240`
 * derives `research_source_category_map.mapping_state` as MAPPED (a `category_id`), IGNORED
 * (`is_ignored`) or UNRESOLVED (neither — the state a row falls into when the Rivya category it
 * pointed at is deleted, because `category_id` is `on delete set null`). This module reads those
 * two columns rather than the generated one, so a caller holding a row it built itself — a Studio
 * form previewing an unsaved mapping — gets the same answers as one holding a row from the table.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT CONTAIN, because each would be a category assignment
 * nobody made: a stemmer, a singulariser, an accent stripper, a synonym table, a fuzzy or
 * edit-distance match, a parent-category fallback, and any rule that reads the *words* of a label.
 * `method` is typed `'MAP' | null` for that reason — there is exactly one way a Rivya category is
 * ever attached to somebody else's label, and it is a row a member of staff typed. A second member
 * of that union would be a guess wearing a name.
 */

/**
 * One staff-authored mapping row, in the shape the repository returns it.
 *
 * `sourcePath` IS CARRIED BUT NEVER MATCHED ON, and the distinction matters. Two labels called
 * "Tables" under different parents are two mappings, and the path is how a *person* tells them
 * apart in the editor — but the table's `unique (source_id, source_label)` is on the label alone,
 * so matching on the pair would let two rows exist that this module treats as different and the
 * database treats as one. The path is presentation; the label is the key.
 */
export interface CategoryMapping {
  readonly id: string
  readonly sourceLabel: string
  readonly sourcePath: string | null
  readonly categoryId: string | null
  readonly isIgnored: boolean
}

/** What resolution concluded. UNMAPPED is a result, not a failure — see the header. */
export type CategoryMatchOutcome = 'MAPPED' | 'IGNORED' | 'UNMAPPED'

/**
 * The answer, including which of the caller's own labels produced it.
 *
 * `matchedLabel` IS THE OBSERVED LABEL AS SUPPLIED, not the mapping's stored spelling. The
 * alternative was considered and loses: a caller resolving a five-segment breadcrumb already holds
 * the mapping rows and can find the stored row from the key, but nothing else can tell it *which
 * segment* stopped the walk — and that is the question a reviewer asks when an answer surprises
 * them. It is null when nothing matched, so "no row anywhere" and "a row that has nothing left to
 * point at" stay distinguishable in an outcome they otherwise share.
 */
export interface CategoryMatch {
  readonly outcome: CategoryMatchOutcome
  readonly categoryId: string | null
  readonly matchedLabel: string | null
  readonly method: 'MAP' | null
}

/**
 * The glyphs sites put BETWEEN breadcrumb segments, stripped only where they trail.
 *
 * WHY THIS EXISTS AT ALL: extraction takes a segment's text node, and a segment sometimes arrives
 * with the separator that followed it still attached — "seating ›" rather than "seating". Removing
 * a trailing run of punctuation cannot change which category a label names, because no category is
 * named by punctuation. That is the entire justification, and it is why nothing else is in the set:
 * a colon, a full stop or a bracket is part of a label somebody might genuinely have written.
 *
 * TRAILING ONLY, AND THE LEADING CASE IS LEFT ALONE ON PURPOSE. Every character this function
 * removes is a character that can make two different labels collide, so the rule is kept to the
 * narrowest form that answers the shape actually observed. If a leading separator turns up in a
 * real scrape, the fix is to widen this one function with a test — not to add a fallback somewhere
 * downstream, which is how a normaliser stops being predictable.
 *
 * The hyphen is last in the class so it is a literal rather than a range. `\s` covers the
 * non-breaking space, which is what `&nbsp;` between a segment and its separator decodes to and is
 * the single most common reason two spellings of one label fail to match.
 */
const TRAILING_SEPARATORS = /[\s/\\|>›»·•–—-]+$/

/**
 * The matching key for a label: lowercase, single-spaced, trimmed, no trailing separator run.
 *
 * AND NOTHING ELSE — no stemming, no singularisation, no synonym table, no accent folding, not even
 * Unicode NFC composition, which is the one addition that looks harmless. Every one of them is a
 * guess about meaning, and a guess here does not stay here: it becomes a category assignment nobody
 * made, on a row a merchandiser will read as a decision somebody took. "Tables" and "table" are two
 * labels until a person says otherwise, and saying otherwise costs them one mapping row.
 *
 * `toLowerCase`, NOT `toLocaleLowerCase`. The key is compared against keys computed elsewhere —
 * possibly on another machine — so an answer that depends on the host's locale is an answer that
 * silently differs between a form's preview and the run that follows it.
 */
export function normaliseLabel(label: string): string {
  return label.toLowerCase().replace(/\s+/g, ' ').trim().replace(TRAILING_SEPARATORS, '')
}

/**
 * Resolve a source's labels for one item — a breadcrumb, a tag list — to a Rivya category.
 *
 * THE LABELS ARE WALKED IN ORDER AND THE FIRST MATCHING ROW IS THE ANSWER, whatever that row says.
 * Order carries meaning that this module has no business second-guessing: a breadcrumb runs from
 * the general to the specific, and the caller chose which end to hand over first.
 *
 * AN IGNORE STOPS THE WALK, because an explicit dismissal is an answer. Continuing past it to find
 * a later label's mapping would let a breadcrumb's second segment overrule a decision somebody made
 * about its first — which is the same failure as guessing, only with a person's dismissal as the
 * thing being overruled.
 *
 * A MATCHED ROW WHOSE CATEGORY HAS BEEN DELETED — the UNRESOLVED state — ALSO STOPS THE WALK, and
 * answers UNMAPPED. The alternative, carrying on to the next label, was written first and is wrong
 * in a way worth recording: it would mean that deleting one Rivya category causes items that used
 * to resolve to it to start resolving to a DIFFERENT one, silently, as a side effect of an
 * unrelated merchandising edit. Stopping makes the same delete produce unmatched rows that the
 * dashboard counts — visible, and closable by re-typing the mapping. `unmappedLabels` reports that
 * label for exactly that reason, so the gap is both counted and named.
 *
 * A CONTRADICTORY ROW IS READ AS AN IGNORE. `research_source_category_map_not_both` refuses a row
 * that is both mapped and dismissed, and `categoryMappingInputSchema` refuses one before the write,
 * so such a row is reachable only by direct SQL. If one is ever met, the reading that cannot invent
 * an assignment is the one to take — this is the behaviour `lib/scraper/core/source-schema.ts`
 * promises on that schema's behalf, stated there as "the mapping reader treats `is_ignored` as
 * final if it ever meets one".
 */
export function resolveCategory(
  labels: readonly string[],
  mappings: readonly CategoryMapping[],
): CategoryMatch {
  const index = indexByKey(mappings)

  for (const label of labels) {
    const key = normaliseLabel(label)
    // A segment that is nothing but separators is a punctuation artefact, not a category. Matching
    // on the empty key would let one source's stray glyph collide with another's.
    if (key === '') continue

    const mapping = index.get(key)
    if (mapping === undefined) continue

    if (mapping.isIgnored) {
      return { outcome: 'IGNORED', categoryId: null, matchedLabel: label, method: 'MAP' }
    }
    if (mapping.categoryId !== null) {
      return {
        outcome: 'MAPPED',
        categoryId: mapping.categoryId,
        matchedLabel: label,
        method: 'MAP',
      }
    }
    // UNRESOLVED: a decision that has lost what it pointed at. `method` is null because nothing
    // decided anything; `matchedLabel` is set because something was found.
    return { outcome: 'UNMAPPED', categoryId: null, matchedLabel: label, method: null }
  }

  return { outcome: 'UNMAPPED', categoryId: null, matchedLabel: null, method: null }
}

/**
 * The observed labels nobody has decided about yet — the dashboard's count, and the editor's
 * left-hand column.
 *
 * RETURNS THE FIRST-SEEN SPELLING, NOT THE KEY. The operator is about to create a mapping row, and
 * `source_label` stores the label exactly as observed because it is evidence. Handing back
 * "dining tables" when the site says "Dining Tables" would seed the form with a value the site
 * never used.
 *
 * DE-DUPLICATED BY KEY, IN FIRST-SEEN ORDER. A crawl yields the same label from hundreds of pages
 * in the order it met them, and a list of gaps is a worklist: the same gap listed twice is one
 * mapping typed and one row that stays on the list looking unfixed.
 *
 * AN IGNORED LABEL IS NOT A GAP — that decision has been taken. AN UNRESOLVED ROW IS ONE, which is
 * the migration's own rule: its comment on `mapping_state` says UNRESOLVED "appears in the
 * dashboard's unmapped figure exactly as a never-mapped label does, which is where somebody will
 * see it and decide again". This is the function that puts it there.
 */
export function unmappedLabels(
  observed: readonly string[],
  mappings: readonly CategoryMapping[],
): readonly string[] {
  const index = indexByKey(mappings)
  const seen = new Set<string>()
  const gaps: string[] = []

  for (const label of observed) {
    const key = normaliseLabel(label)
    if (key === '') continue
    if (seen.has(key)) continue
    seen.add(key)

    const mapping = index.get(key)
    const decided = mapping !== undefined && (mapping.isIgnored || mapping.categoryId !== null)
    if (!decided) gaps.push(label)
  }

  return gaps
}

/**
 * The keys that more than one mapping row resolves to — what a form must say before it saves.
 *
 * WHY THIS CAN HAPPEN AT ALL: `unique (source_id, source_label)` is on the RAW label, so "Dining
 * Tables" and "dining tables" are two rows the database is perfectly happy to store, and this
 * module resolves them identically. One of them is then dead configuration — a decision somebody
 * took, saved, and will never see applied — and nothing about the row itself says so.
 *
 * RETURNS THE KEY ONCE PER CLASH, NOT EVERY COLLIDING SPELLING. Three rows that collide are one
 * problem, and a form that lists it three times is saying the same thing three times; the caller
 * holds the rows and can select the offenders by comparing `normaliseLabel(sourceLabel)` to the
 * key. Order is first-seen, so the message is stable between renders of the same list.
 *
 * A row whose label normalises to nothing at all is reported like any other. It cannot be created
 * through the drawer — the schema requires a non-empty trimmed label — and if two such rows ever
 * exist they do collide, so saying so is the truthful answer rather than a special case.
 */
export function duplicateMappingLabels(mappings: readonly CategoryMapping[]): readonly string[] {
  const counts = new Map<string, number>()
  const firstSeen: string[] = []

  for (const mapping of mappings) {
    const key = normaliseLabel(mapping.sourceLabel)
    const before = counts.get(key) ?? 0
    counts.set(key, before + 1)
    if (before === 0) firstSeen.push(key)
  }

  return firstSeen.filter((key) => (counts.get(key) ?? 0) > 1)
}

/**
 * The rows by matching key.
 *
 * THE FIRST ROW WINS A COLLISION, and the choice is not arbitrary: the repository reads these in
 * creation order, so the first is the oldest decision — the one that has been in effect while
 * nobody noticed the clash. Letting the newest win would mean a row saved today silently changing
 * how items resolved yesterday. Neither answer is *right*, which is what `duplicateMappingLabels`
 * is for: the clash is meant to be refused at the form, not adjudicated here.
 */
function indexByKey(mappings: readonly CategoryMapping[]): ReadonlyMap<string, CategoryMapping> {
  const index = new Map<string, CategoryMapping>()
  for (const mapping of mappings) {
    const key = normaliseLabel(mapping.sourceLabel)
    if (key === '') continue
    if (!index.has(key)) index.set(key, mapping)
  }
  return index
}
