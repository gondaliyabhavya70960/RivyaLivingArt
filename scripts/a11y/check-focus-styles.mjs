#!/usr/bin/env node
/**
 * NO UNREPLACED FOCUS INDICATOR (Phase 41, WCAG 2.2 §2.4.7 and §2.4.11)
 *
 * `outline: none` is the single most common way a site becomes unusable by keyboard. It is usually
 * written to remove a default ring somebody found ugly, and it removes the only thing telling a
 * keyboard user where they are.
 *
 * IT IS NOT BANNED, IT IS MADE CONDITIONAL. Removing the browser's outline is legitimate when
 * something else takes its place — a ring drawn with `box-shadow`, a border that changes, a
 * `:focus-visible` rule elsewhere in the same block. The rule here is that the REPLACEMENT MUST BE
 * VISIBLE IN THE SAME RULE, so a reviewer reading the diff sees both halves.
 *
 * THE ONE CASE THAT NEEDS NO REPLACEMENT is `:focus:not(:focus-visible)`, which is the standard
 * idiom for "do not show a ring for a mouse click". `:focus-visible` fires for keyboard and
 * assistive input and keeps its own ring; this selector removes the ring only for the pointer case
 * that never needed one. `app/styles/base.css` uses exactly that and must keep passing.
 *
 * IT SCANS CSS AND TAILWIND CLASS NAMES BOTH, because `outline-none` in a `className` is the same
 * act written in a different language, and it is the more common one in this codebase.
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

/** Anything that visibly marks focus. If one of these is in the same rule, the outline may go. */
const REPLACEMENTS = [
  /box-shadow\s*:/,
  /border(?:-[a-z]+)?\s*:/,
  /outline\s*:\s*(?!none|0)/,
  /background(?:-color)?\s*:/,
  /ring-/,
  /shadow-/,
]

/** Selectors that legitimately remove the ring with nothing in its place. */
const EXEMPT_SELECTOR = /:focus:not\(\s*:focus-visible\s*\)/

const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '*.css', '*.tsx', '*.ts'],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean)

const problems = []
let cssRules = 0
let classUses = 0
let programmaticTargets = 0

for (const file of files) {
  const source = readFileSync(file, 'utf8')

  if (file.endsWith('.css')) {
    // Comments stripped: this file's own documentation quotes the thing it forbids.
    const css = source.replace(/\/\*[\s\S]*?\*\//g, ' ')
    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = match[1].trim().replace(/\s+/g, ' ')
      const body = match[2]
      if (!/outline\s*:\s*(?:none|0)\b/.test(body)) continue
      cssRules += 1
      if (EXEMPT_SELECTOR.test(selector)) continue
      if (REPLACEMENTS.some((pattern) => pattern.test(body))) continue
      problems.push(
        `${file} — \`${selector}\` removes the outline with nothing visible in its place. Add a ` +
          '`box-shadow` ring, a border change, or scope the rule to `:focus:not(:focus-visible)`.',
      )
    }
    continue
  }

  /*
   * TAILWIND'S `outline-none`, IN A CLASS LIST. The replacement has to be in the same class list,
   * which is a stricter reading than the CSS case allows and is right for the same reason: a
   * `focus:ring-2` three components away is not something a reviewer can see from the diff.
   *
   * `focus-visible:outline-none` IS EXEMPT for the same reason as its CSS equivalent — except that
   * it is NOT, and that asymmetry is the point. `focus:outline-none` removes the ring for keyboard
   * focus too, because Tailwind's `focus:` maps to `:focus`, not `:focus-visible`.
   */
  for (const match of source.matchAll(
    /class(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g,
  )) {
    const classes = match[1] ?? match[2] ?? match[3] ?? ''
    if (!/\boutline-none\b/.test(classes)) continue
    classUses += 1
    if (/\b(?:focus(?:-visible)?:)?(?:ring-|shadow-|border-|bg-)/.test(classes)) continue

    /*
     * A PROGRAMMATIC FOCUS TARGET IS THE ONE EXEMPTION, and the codebase has exactly one:
     * `Configurator`'s step heading, a `tabIndex={-1}` wrapper that focus is MOVED to after a step
     * change so a screen reader announces the new step.
     *
     * `tabIndex={-1}` TAKES AN ELEMENT OUT OF THE TAB ORDER, so nobody ever arrives here by
     * pressing Tab. They arrive because our own code moved them, one keystroke after they pressed
     * "next" — the feedback they need is the new heading, which is what they have been moved to. A
     * ring around an invisible wrapper at that moment is noise, and `<main tabIndex={-1}>` in the
     * site shell is the same pattern.
     *
     * IT IS COUNTED AND PRINTED, not silently skipped, so the exemption stays a number somebody can
     * see growing.
     */
    const openingTag = source.slice(Math.max(0, (match.index ?? 0) - 300), match.index ?? 0)
    if (/tabIndex=\{-1\}/.test(openingTag) || /tabIndex="-1"/.test(openingTag)) {
      programmaticTargets += 1
      continue
    }

    const line = source.slice(0, match.index ?? 0).split('\n').length
    problems.push(
      `${file}:${String(line)} — \`outline-none\` in a class list with no ring, shadow, border or ` +
        'background change beside it, on an element that IS in the tab order.',
    )
  }
}

if (problems.length > 0) {
  console.error(`✗ focus styles: ${String(problems.length)} problem(s):`)
  for (const problem of problems) console.error(`    ${problem}`)
  console.error(
    '\n  A keyboard user has nothing but the focus indicator to tell them where they are.\n' +
      '  WCAG 2.2 §2.4.7 requires one; §2.4.11 requires it not to be obscured.',
  )
  process.exit(1)
}

console.log(
  `✓ focus styles: ${String(cssRules)} CSS rule(s) and ${String(classUses)} class list(s) remove an ` +
    'outline, every one of them with a replacement, scoped to the pointer-only case, or on a ' +
    `programmatic focus target (${String(programmaticTargets)} of those)`,
)
