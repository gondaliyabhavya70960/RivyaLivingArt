# Project skills

Ten skills encoding this repository's own rules, each grounded in a constraint a gate enforces or a
defect this project actually shipped and fixed.

| Skill | Use it when |
|---|---|
| `design-tokens` | Writing any colour, length, duration or Tailwind class |
| `section-renderer` | Adding or editing a CMS block in `components/sections/` |
| `motion-classes` | Any animation, transition, transform or scroll effect |
| `accessibility-contract` | Interactive components, headings, forms, colour pairings |
| `media-binding` | Binding media, adding a slot, or diagnosing an empty frame |
| `content-integrity` | Before writing ANY copy, seed row, spec or legal text |
| `island-budget` | Before adding `'use client'` or an interactive library |
| `verify-before-push` | Before every commit; when a test fails unexpectedly |
| `external-components` | Before adopting any third-party component |
| `studio-surfaces` | Anything under `app/(studio)/` |

## Third-party design skills

Five skills installed with `npx skills add`. The installer puts the real files in
`.agents/skills/<name>/` and symlinks `.claude/skills/<name>` at them, so Claude Code discovers them
while other agents read the same copy. `skills-lock.json` at the repository root records each
source and a content hash.

| Skill | Source | Licence | Good for here |
|---|---|---|---|
| `frontend-design` | `anthropics/skills` | Apache 2.0 | Aesthetic reasoning, anti-default calibration, interface writing |
| `web-design-guidelines` | `vercel-labs/agent-skills` | MIT | Reviewing UI code against the Web Interface Guidelines |
| `high-end-visual-design` | `leonxlnx/taste-skill` | MIT | Spatial rhythm, nested container detail, performance guardrails |
| `design-md` | `google-labs-code/stitch-skills` | Apache 2.0 | Describing a design system in prose (needs the Stitch MCP server) |
| `ui-ux-pro-max` | `nextlevelbuilder/ui-ux-pro-max-skill` v2.13.0 | MIT | Layout, UX guidelines, interaction patterns, chart selection |

`frontend-design` ships `LICENSE.txt`; `high-end-visual-design`, `design-md` and `ui-ux-pro-max`
carry a `LICENSE` fetched from their source repository. **`web-design-guidelines` has none** —
upstream declares MIT in its README and ships no licence file, so none was invented here.

### Where these conflict with this repository

**The first-party skills above win every one of these.** They encode gates; these encode taste.

| What a third-party skill says | Why this repository cannot do it |
|---|---|
| `high-end-visual-design` §2 bans Inter outright — using it means the design "instantly fails" | Inter **is** the body and Studio UI face, fixed by amendment A46 against a measured reference |
| `high-end-visual-design` §5C mandates scroll entry: `opacity-0` → `opacity-100`, plus `blur-md` | A48 **deleted** opacity animation from the motion layer. `animation-fill-mode: both` on a `view()` timeline held a band at `opacity: 0.184` — **1.82:1** contrast where opaque is 17.55:1 — failing axe at SERIOUS on `/large-format` at 390px. `tests/unit/motion-layer.test.ts` asserts no keyframe animates opacity at all, so following this **fails a test and re-opens a fixed defect** |
| `high-end-visual-design` §5C suggests Framer Motion `whileInView` | This project ships **no animation runtime**. §4.2 uses CSS `animation-timeline: view()`, and the island budget is 5 |
| Hex literals throughout (`#050505`, `#FDFBF7`, `rgba(255,255,255,0.15)`); `ui-ux-pro-max`'s 192 palettes | `app/styles/tokens.css` is the **only** file permitted a colour literal — `check-tokens.mjs` fails the build otherwise |
| Arbitrary Tailwind values (`rounded-[2rem]`, `text-[10px]`, `delay-150`) | `check-token-usage.mjs` governs those families; values come from `--rv-*` |
| `ui-ux-pro-max`'s 74 font pairings | The display face is fixed — Instrument Serif, chosen in A46 |
| `design-md` writes `DESIGN.md`; `ui-ux-pro-max --persist` writes `MASTER.md` | Both create a **second design system** beside `docs/architecture/DESIGN_SYSTEM.md`. Do not write either |
| `high-end-visual-design`'s "Variance Mandate" — never the same layout twice | A design system is the opposite of per-page variance |

**The two loudest skills contradict each other**, which is worth knowing before trusting either:
`frontend-design` lists "fade-and-slide-up entrances on each section" among the commonest tells of a
generated page, while `high-end-visual-design` requires them on every element. This repository
already settled it on measured evidence — see A48 above.

Where they agree they are worth following, and they agree on more than they disagree: animate only
`transform` and `opacity`, never `window.addEventListener('scroll')`, `backdrop-blur` only on fixed
elements, `min-h-[100dvh]` over `h-screen`, disciplined z-index, visible focus, reduced motion
respected.

### Two things to know before relying on them

**`web-design-guidelines` is not pinned.** It fetches its actual rules at review time from
`raw.githubusercontent.com/vercel-labs/web-interface-guidelines`. The lockfile hash covers the 1.2 KB
stub, **not** the guidance it applies — upstream can change what it checks with no diff here. It also
needs network access. Treat its findings as advisory and let this repository's own accessibility
gates be authoritative.

**`design-md` cannot run in this session.** Its retrieval steps require the Stitch MCP server, which
is not connected.

### Why no notes were added inside these files

An earlier install of `ui-ux-pro-max` carried a local note at the top of its `SKILL.md`. Re-running
the installer **silently overwrote it** — and dropped its `LICENSE` and its path fix with it. A note
inside a managed file does not survive an update, so the conflicts live here instead, in a file no
installer writes. After any `npx skills update`, re-check this table rather than the skill files.
The path fix and licences restored after that overwrite are recorded in `CHANGELOG.md`.

## Format note

`SKILL.md` with YAML frontmatter is a Claude Code convention — Claude Code discovers these
automatically from `.claude/skills/`. ChatGPT and other assistants have no equivalent auto-loading,
but the files are plain markdown and can be pasted or referenced directly.

**The first-party skills encode rules, not preferences.** Where one states a constraint it names the
gate or the document that enforces it, so a reader can check rather than trust. Where it cites a
measurement, that measurement was taken in this repository.
