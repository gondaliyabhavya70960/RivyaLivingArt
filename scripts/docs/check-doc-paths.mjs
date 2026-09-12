#!/usr/bin/env node
/**
 * DOES EVERY SOURCE PATH A DOCUMENT NAMES ACTUALLY EXIST? — Phase 46.
 *
 * WHY IT IS SEPARATE FROM THE CLAIM GATE. `check-doc-contract.mjs --claims` asks whether a documented
 * CAPABILITY names an implementing artefact, and it passes as long as the block names something that
 * resolves. That is a different question from whether EVERY path in the prose resolves, and the
 * difference is not academic: `BUSINESS_RULES.md` cites `tests/integration/forbidden-tables.test.ts`,
 * `tests/e2e/no-commerce.spec.ts` and `tests/unit/rls/inquiries.test.ts` as the enforcement behind the
 * three absolute commerce prohibitions, and NONE OF THE THREE IS IN THE REPOSITORY. The claim gate
 * passed those rules, correctly, because each names other things that do exist. This one would not.
 *
 * THE NOTATION HAS TO BE UNDERSTOOD BEFORE ANYTHING IS REPORTED, or the output is noise. These
 * documents write `components/patterns/{ProductCard,ArticleCard}/index.tsx` for two files and
 * `components/sections/<Type>.tsx` for a shape. A naive scan reports 316 missing paths, of which most
 * are notation — and a report that is mostly wrong gets ignored, which is worse than no report. So
 * brace groups are expanded and placeholders (`<…>`, `…`, `*`) are skipped entirely.
 *
 * IT REPORTS IN TWO CLASSES, BECAUSE THEY MEAN DIFFERENT THINGS.
 *
 *   PLAN        `docs/project/phases/*.md` are specifications written BEFORE the code. A path they
 *               name and the repository lacks is ordinary drift — the plan said
 *               `app/(studio)/studio/content/faqs/page.tsx` and the route group `(shell)` was
 *               introduced later. Reported, never failed on.
 *   DESCRIPTIVE Every other document describes what EXISTS. A path it names and the repository lacks
 *               is a document describing a repository that is not this one.
 *
 * IT IS NOT IN `npm run check`, AND THAT IS A DELIBERATE, TEMPORARY STATE. There are 74 descriptive
 * misses today; a gate that fails the build the hour it lands is a gate somebody deletes by Friday.
 * `docs/project/ROADMAP.md`'s post-launch backlog carries the work of driving that number down, and
 * the last line of this script is the threshold to wire in once it is zero. Run it with `--strict` to
 * get that behaviour now.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const CITED =
  /`((?:tests|scripts|lib|app|components|content|supabase)\/[^`\s]+\.(?:ts|tsx|mjs|py|sql))`/g
const PLACEHOLDER = /[<>…*]/

/**
 * A CITATION INSIDE A SENTENCE THAT SAYS IT IS MISSING IS A REPORT, NOT A CLAIM — and getting this
 * wrong inverts the whole measure.
 *
 * The first version of this script lacked it, and the count went UP, 84 to 86, the moment
 * `BUSINESS_RULES.md` was corrected to say "`tests/integration/forbidden-tables.test.ts` does not
 * exist" — because naming a file in order to report its absence looks exactly like naming it as
 * enforcement. **A number that rises when somebody documents the truth is worse than no number**: it
 * penalises the fix and rewards leaving the false citation in place. It would also have made this
 * phase's own corrections look like regressions.
 *
 * So the block around each hit is read, the same way `audit-docs.mjs --claims` reads the block around
 * a vocabulary hit, and a hit whose block says the file is absent is counted separately.
 */
const ABSENCE =
  /does not exist|do not exist|NOT WRITTEN|not written|is missing|are missing|never written|no longer exists|not in the repository|neither/i

/** The contiguous run of non-blank lines around a line — a paragraph, or a table row with its header. */
function blockAround(lines, index) {
  let start = index
  let end = index
  while (start > 0 && (lines[start - 1] ?? '').trim() !== '') start -= 1
  while (end < lines.length - 1 && (lines[end + 1] ?? '').trim() !== '') end += 1
  return lines.slice(start, end + 1).join('\n')
}

/** Expand `{a,b}` one group at a time — the shorthand these documents actually use. */
export function expandBraceGroups(path) {
  const match = /\{([^{}]*)\}/.exec(path)
  if (match === null) return [path]
  return match[1]
    .split(',')
    .flatMap((option) =>
      expandBraceGroups(
        path.slice(0, match.index) + option.trim() + path.slice(match.index + match[0].length),
      ),
    )
}

function markdownFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'requirements') continue // Read-only specifications of record.
      markdownFiles(full, out)
    } else if (entry.endsWith('.md')) {
      out.push(full)
    }
  }
  return out
}

export function auditDocumentPaths(root = process.cwd()) {
  const plan = []
  const descriptive = []
  let checked = 0
  let reported = 0

  for (const doc of markdownFiles(join(root, 'docs'))) {
    const relative = doc.slice(root.length + 1)
    const isPlan = relative.startsWith('docs/project/phases/')
    const lines = readFileSync(doc, 'utf8').split('\n')

    for (const [index, line] of lines.entries()) {
      for (const [, cited] of line.matchAll(CITED)) {
        if (PLACEHOLDER.test(cited)) continue
        for (const path of expandBraceGroups(cited)) {
          checked += 1
          if (existsSync(join(root, path))) continue
          if (ABSENCE.test(blockAround(lines, index))) {
            reported += 1
            continue
          }
          ;(isPlan ? plan : descriptive).push({ doc: relative, path })
        }
      }
    }
  }
  return { checked, reported, plan, descriptive }
}

function main() {
  const strict = process.argv.includes('--strict')
  const { checked, reported, plan, descriptive } = auditDocumentPaths()

  const byDoc = new Map()
  for (const miss of descriptive) {
    byDoc.set(miss.doc, [...(byDoc.get(miss.doc) ?? []), miss.path])
  }

  console.log(
    `documentation paths: ${String(checked)} concrete path(s) cited across docs/ ` +
      `(brace groups expanded, placeholders skipped)`,
  )
  console.log(
    `  plan documents   : ${String(plan.length)} not present — docs/project/phases/*.md are written ` +
      `before the code, so this is drift rather than a false claim`,
  )
  console.log(
    `  reported absent  : ${String(reported)} named inside a sentence saying they do not exist — ` +
      `a report, not a claim`,
  )
  console.log(
    `  descriptive docs : ${String(descriptive.length)} not present, in ${String(byDoc.size)} document(s)`,
  )

  for (const [doc, paths] of [...byDoc].sort()) {
    console.log(`\n    ${doc} (${String(paths.length)})`)
    for (const path of [...new Set(paths)].sort()) console.log(`      ${path}`)
  }

  if (strict && descriptive.length > 0) {
    console.error(
      `\n✗ ${String(descriptive.length)} path(s) named by a descriptive document do not exist.`,
    )
    process.exit(1)
  }
  console.log(descriptive.length === 0 ? '\n✓ every cited path resolves' : '')
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) main()
