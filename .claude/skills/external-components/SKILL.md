---
name: external-components
description: Use before adopting, installing or copying any third-party UI component, library or snippet. Encodes the licence allowlist, how to evaluate per component, and the labelling rule that separates adoption from approximation.
---

# Read the source before you adopt anything

## Licence allowlist

**MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC.** Nothing else.

Verify from a primary source — the repository `LICENSE` and the npm metadata — not from a marketing
page. Two real findings from doing this:

- **React Bits is `MIT + Commons Clause`, not MIT.** An added condition forbidding selling,
  sublicensing or redistributing the components. It fails the allowlist on its face.
- A package's own `package.json` may declare **no licence** while the repository is MIT. Record
  where the grant actually comes from.

## Evaluate per component, not per source

A source-level rejection is evidence, not proof that every candidate from it fails. For each
candidate record: exact source page, source file or revision, licence evidence, dependencies, target
file, adaptation, mobile behaviour, accessibility, measured bundle impact, adoption status.

**Read the actual file.** A component evaluated only from its demo page is not evaluated. When a
marketing host is unreachable, the source is usually still findable — `pnpm-workspace.yaml` or the
repo `README` will reveal the layout, and `raw.githubusercontent.com` serves files by exact path.
If you genuinely cannot read it, **say so** and do not adopt.

## What usually disqualifies a component here, and it is rarely the licence

1. **It is a Client Component** — an island on all sixteen CMS routes (see `island-budget`).
2. **It brings an animation runtime.** This project ships none — no `motion`, no `framer-motion`,
   no `gsap`. Adding the first is a real decision.
3. **It brings a second token vocabulary.** A themed Tailwind plugin installs component classes and
   palettes carrying colour literals, against the one-vocabulary rule. `check-tokens.mjs` fails.
4. **It is less accessible than what you already have.** Check the full APG contract, not the roles.
   A tabs component with `role="tablist"` and **zero `aria-controls`** is a strip, not tabs.

## The labelling rule

A first-party approximation must **never** be reported as an imported library component. If you
build something inspired by an external source, record it as **first-party work with that source as
a visual reference**. Preserve required notices for anything actually adopted.

## Read before editing

`docs/design/COMPONENT_REGISTRY.md` §4 (licence policy), §5 (source audit), §5.1 and §5.2
(per-component reviews).
