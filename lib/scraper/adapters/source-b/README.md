# `source-b` — the second vendor adapter placeholder

The same thing as `../source-a/`, and deliberately not a second copy of its README. The long form —
what a vendor adapter is for, when configuration is the better answer, the contract an adapter is
written against, and what must never happen in this tree — is written out once, next door. Two
copies of one argument drift, and the copy that drifts is the one somebody happens to open.

**Read `../source-a/README.md`.** Everything in it applies here word for word. What follows is the
short statement of the same four rules, so that this folder is not a riddle for whoever opens it
first.

1. **`source-b` names nobody.** It is FEAT §27's own placeholder name, not a stand-in for a company.
   No competitor, brand, domain or price appears anywhere in this repository (D10).
2. **A vendor adapter is added by the owner, and only after that source has passed policy review.**
   Until an owner or admin has recorded `APPROVED` with a note — the Phase 26 workflow, needing
   `research.write` and `system.settings.write` together — there is nothing here to write rules
   against. The approved source's host then lives in `research_sources.base_url`, a row somebody is
   accountable for, and never in a build artefact.
3. **`supports()` returns `false`, unconditionally, which is what keeps an unfinished adapter
   unselectable.** Not a comment, not a `TODO`: a predicate that refuses everything. Anything less
   lets a source be configured against rules that do not exist, and the failure then arrives as a
   nightly run that fetches politely and produces nothing.
4. **No external host may be hard-coded anywhere under `lib/scraper/adapters/**`** — not in a
   predicate, not in a fixture, not in a comment, and not in this file.
   `scripts/research/check-research-isolation.mjs` greps the tree and fails the build;
   `tests/unit/adapter-contract.test.ts` asserts the same rule a step earlier, where a developer
   meets it before CI does. Reserved `example.` domains, loopback and the vocabulary namespaces are
   the only things admitted.

**Why there are two of these at all.** The requirement's tree shows two vendor folders, and it shows
two in order to say that vendor adapters are plural: the architecture expects several, and adding
the second must not touch `lib/scraper/core/**`. A single folder would have read as a special case
rather than as the second instance of a shape.
