#!/usr/bin/env tsx
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import ts from 'typescript'

/**
 * No visitor-readable literal may appear in a public section renderer.
 *
 * THE RULE THIS ENFORCES is CLAUDE.md's "no marketing copy inside JSX": components render
 * `section.heading`, never a headline. It is the easiest rule in the project to break by accident
 * and the hardest to notice afterwards, because a hard-coded sentence and a CMS one look
 * identical on the rendered page. The owner then cannot change it without a code change, which is
 * the failure D2 and SEED §1 exist to prevent.
 *
 * WHY AN AST AND NOT A REGEX. Every one of these files is full of string literals that are
 * perfectly fine — class names, `sizes` values, ratio strings, keys. What distinguishes copy is
 * its POSITION: a literal that ends up as a JSX child, or as the value of an attribute a screen
 * reader or a visitor reads. A regex cannot see position; the parser can, and it is already a
 * dependency.
 *
 * WHAT IS ALLOWED, and why each is not copy:
 *   - Attribute values that are not read aloud: className, href, sizes, ratio, preset, key…
 *   - `aria-hidden`, which takes a boolean-ish literal and hides content rather than describing it.
 *   - Single characters and punctuation used as separators (—, ·, /).
 *   - Anything under a `__tests__` or `*.test.tsx` path: a fixture's copy is not shipped.
 *
 * WHAT IS FLAGGED: JSX text, a string literal passed as a child, and a literal given to
 * `alt`, `title`, `aria-label`, `aria-description`, `placeholder`, `label`, `fallbackLabel` or
 * `playLabel` — the props whose value a person reads or hears.
 */

const ROOT = process.cwd()
const TARGET = join(ROOT, 'components', 'sections')

/** Props whose value reaches a visitor. A literal here is copy, wherever it sits in the tree. */
const SPOKEN_PROPS = new Set([
  'alt',
  'title',
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'placeholder',
  'label',
  'fallbackLabel',
  'playLabel',
  'summary',
])

/**
 * Separators and symbols that carry no language.
 *
 * Deliberately tiny. Anything longer than a single glyph is a word, and a word is copy — "and",
 * "or" and "&" all belong in the database when a visitor reads them.
 */
const PUNCTUATION = /^[\s–—·•/|,.:;()[\]{}<>+\-*&#@%~^=_'"`\\!?]*$/u

type Finding = {
  readonly file: string
  readonly line: number
  readonly text: string
  readonly why: string
}

function tsxFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue
      out.push(...tsxFiles(full))
    } else if (entry.name.endsWith('.tsx') && !entry.name.includes('.test.')) {
      out.push(full)
    }
  }
  return out
}

function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  return null
}

function check(file: string): Finding[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const findings: Finding[] = []
  const at = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1

  const report = (node: ts.Node, text: string, why: string) => {
    if (PUNCTUATION.test(text)) return
    findings.push({ file: relative(ROOT, file), line: at(node), text: text.trim(), why })
  }

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      // JSX text is whitespace between elements far more often than it is content; only a run
      // with a letter or a digit in it is a sentence someone will read.
      if (/[\p{L}\p{N}]/u.test(node.text)) report(node, node.text, 'JSX text')
    }

    if (ts.isJsxExpression(node) && node.parent && ts.isJsxElement(node.parent)) {
      const text = node.expression === undefined ? null : literalText(node.expression)
      if (text !== null) report(node, text, 'string literal as a JSX child')
    }

    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(source)
      if (SPOKEN_PROPS.has(name) && node.initializer !== undefined) {
        const init = node.initializer
        const text =
          literalText(init) ??
          (ts.isJsxExpression(init) && init.expression !== undefined
            ? literalText(init.expression)
            : null)
        if (text !== null) report(node, text, `literal \`${name}\``)
      }
    }

    ts.forEachChild(node, visit)
  }

  ts.forEachChild(source, visit)
  return findings
}

const files = tsxFiles(TARGET)
const findings = files.flatMap(check)

if (findings.length > 0) {
  console.error(
    `Visitor-readable literals in public section renderers (${findings.length}).\n` +
      'Every string a visitor reads comes from the CMS: a section field, or `global_content`\n' +
      'via `siteString()`. See CLAUDE.md, "No marketing copy inside JSX".\n',
  )
  for (const finding of findings) {
    console.error(
      `  ${finding.file}:${finding.line}  ${finding.why}: ${JSON.stringify(finding.text)}`,
    )
  }
  process.exit(1)
}

console.log(`check-section-copy: ${files.length} renderers, no visitor-readable literals.`)
