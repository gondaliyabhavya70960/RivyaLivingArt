# `source-a` — a vendor adapter placeholder

This folder holds an adapter that supports nothing and extracts nothing. It is not unfinished work
that somebody forgot; it is the shape FEAT §27 draws, kept empty on purpose. `source-b/` beside it
is the same thing again, and `generic/` is the only adapter in this repository that reads anything.

**`source-a` names nobody.** It is the requirement's own placeholder name, not a stand-in for a
company whose real name belongs here instead. Nothing in this repository names a competitor, a
brand, a domain or a price (D10), and an adapter is where the first one would appear.

## What a vendor adapter is for

Every behavioural difference between two sources is meant to be **a database column, a child row or
an adapter — and never a branch inside `lib/scraper/core/**`**. Most differences turn out to be
configuration: a crawl delay, a currency, a URL pattern, a category mapping, a CSS selector for a
price. All of those are Phase 26 fields, editable in Studio by somebody who does not deploy, and a
source that needs only those needs no adapter at all — `generic` reads it.

A vendor adapter earns its place when a source publishes its product data in a shape no
configuration can describe: a bespoke script tag instead of JSON-LD, a specification table whose
meaning is positional, a pagination scheme that cannot be expressed as a pattern. Then the rules for
reading that one site live in one folder, are reviewed on their own, and cannot affect anybody else
— which is the whole of FEAT §27's constraint that *a broken source adapter must not break other
sources*.

If reading a source appears to require editing `lib/scraper/core/**`, the requirement belongs in a
column, not in a branch. That is the test to apply before writing anything here.

## Who fills this in, and when

**The owner does, in a deployment of their own, and only after that source has passed policy
review.** Policy review is the Phase 26 workflow: a researcher marks a source `READY_FOR_REVIEW`,
and an owner or admin — the pairing needs `research.write` *and* `system.settings.write` — records
`APPROVED`, `RESTRICTED` or `BLOCKED` with a mandatory note. An adapter written before that decision
is code that presumes the answer, and the presumption is visible in the git history whichever way
the review later goes.

By the time a real adapter exists, the source's host lives in `research_sources.base_url` — a row
somebody approved, which can be edited, restricted or deleted by the person accountable for it. It
must never live in a build artefact, where it is a permanent claim about who Rivya reads.

## The two rules this folder enforces by being empty

**`supports()` returns `false`, unconditionally, and that is what keeps an unfinished adapter
unselectable.** It is the one line that has to be right in a placeholder. A predicate that answered
"yes" — even for a single URL shape somebody was testing against — would let a source be configured
against rules that do not exist, and the failure would arrive as a nightly run that fetches
politely, produces nothing, and says nothing about why. The predicate here takes no argument at all,
so there is not even a source in scope to be tempted to branch on.

**No external host may be hard-coded anywhere under `lib/scraper/adapters/**`.**
`scripts/research/check-research-isolation.mjs` greps this tree for one and fails the build, and
`tests/unit/adapter-contract.test.ts` asserts the same rule where a developer meets it first —
including in this file, because prose is as public as code. Reserved `example.` domains and loopback
are admitted, because fixtures have to say something and those two say nothing about anybody; so are
the vocabulary namespaces (`schema.org`, `ogp.me`), which are identifiers compared against rather
than hosts to fetch — and no adapter has a fetcher to resolve one with in any case.

## Writing the real thing

`docs/architecture/SCRAPER.md` §5.7 is the procedure and is the copy to follow; it is not repeated
here, because a second copy of a checklist is a checklist that goes stale. What is worth restating
is the shape of the contract it is written against, since it is unusually narrow:

- **An adapter is a pure function from bytes to a draft.** `AdapterContext` carries the source
  configuration, the URL matcher, a logger and a budget predicate — and nothing else. No `fetch`, no
  database handle, no file system, no Cloudinary client, no clock. Every absence is argued in
  `../types.ts`; each one is a side effect that belongs to the core, and an adapter that had it
  would be a request nobody gated, a write nobody audited, or a reading of the clock that makes two
  extractions of an unchanged page hash differently.
- **Strings only.** `RawProductDraft` types every extracted field as the source's own text. An
  adapter never parses a number, converts a unit, resolves a currency or maps a category — Phase 28
  does all four, once, over stored evidence, so that a rule corrected years later can be re-run
  against what the page actually said. A numeric field fails the Zod schema at the boundary.
- **Record what found each value.** Set `confidence[field] = 1` only for a field genuinely found,
  and name the strategy in `provenance` from the closed list in `../draft-schema.ts`. `withField`
  does both and enforces first-hit-wins, so a strategy order written as a sequence of calls is
  correct by construction.
- **Never throw for a page you cannot read.** Malformed markup, a missing price, a category page
  served where a product page was expected: each is a low-confidence draft, which is a fact a
  merchandiser can see. A throw means the adapter is broken, and `../../core/run-adapter.ts` treats
  it as one — the item fails, ten consecutive failures stop that source for the rest of the run, and
  three such runs open its circuit.
- **Parse markup with `node-html-parser`, never with a regular expression.** It is the only HTML
  parser this repository has, and a regex over somebody else's markup produces silent nonsense
  rather than a visible failure.
- **At least three golden fixtures**, under `tests/fixtures/scraper/<key>/`, one of them malformed.
  The shared contract suite requires them of every adapter declaring `EXTRACT`. This folder declares
  no capabilities at all, so it is exempt — and the exemption is asserted there explicitly, rather
  than left as a silent gap in a loop.

## What must never happen here

No image is downloaded, cached, re-hosted, thumbnailed or measured. `RawProductDraft.imageUrls`
holds strings, and this context offers nothing that could turn one into bytes. No headless browser,
no proxy rotation, no CAPTCHA solving, no user-agent rotation — permanently, and enforced by the
same guard. And nothing extracted here is ever a Rivya product: a research row becomes one only by
an owner typing it, and there is no code path that does it for them.
