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

**Format note.** `SKILL.md` with YAML frontmatter is a Claude Code convention — Claude Code
discovers these automatically from `.claude/skills/`. ChatGPT and other assistants have no
equivalent auto-loading, but the files are plain markdown and can be pasted or referenced directly.

**They encode rules, not preferences.** Where a skill states a constraint it names the gate or the
document that enforces it, so a reader can check rather than trust. Where it cites a measurement,
that measurement was taken in this repository.
