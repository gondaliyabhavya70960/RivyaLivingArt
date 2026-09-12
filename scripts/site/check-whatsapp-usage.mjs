#!/usr/bin/env node
/**
 * site:check-whatsapp-usage — the D1 conversion rule, enforced where types cannot reach.
 *
 * "An inquiry must be persisted before any WhatsApp redirect. Never redirect if the save failed."
 * `buildHandoffUrl` enforces the first half at compile time by requiring a non-optional
 * `inquiryId`. This file closes the two holes a type cannot:
 *
 *   1. A HAND-WRITTEN LINK. `<a href="https://wa.me/91...">` type-checks perfectly and bypasses
 *      the whole module. No literal WhatsApp host may appear outside `lib/whatsapp/**`.
 *   2. `buildDirectContactUrl` ON A CONVERSION SURFACE. It exists for the announcement bar, the
 *      footer and the contact page — places where there is nothing to record yet. Imported into a
 *      product page or a commission form it becomes exactly the bypass the rule forbids, and it
 *      does so while looking like the sanctioned helper. Its `source` union already refuses the
 *      value such a caller would need; this refuses the import as well, so the bypass cannot be
 *      built even in stages.
 *
 * `buildHandoffUrl` HAS NO IMPORT ALLOWLIST, deliberately. Its signature makes a premature call
 * impossible, so restricting where it may be imported would add a list to maintain for no gain.
 *
 * COMMENTS ARE STRIPPED BEFORE THE HOST SEARCH; STRING LITERALS ARE NOT. A host in real code is
 * always inside a string, so blanking strings would erase the thing being checked — the gate would
 * pass a planted `https://wa.me/...` while looking like it worked. Comments still go, so the doc
 * comments that explain this rule do not report themselves. The import scan runs on raw source for
 * the mirror-image reason: an import specifier is a string literal.
 *
 * Exit 1 on any violation. Runs in `npm run check` and in CI.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { stripCommentsAndStrings } from '../db/strip-code.mjs'

const ROOT = process.cwd()
const MODULE_PREFIX = join('lib', 'whatsapp') + sep

/** The hosts. `api.whatsapp.com` is the older form and works identically, so both are banned. */
const HOSTS = /wa\.me|api\.whatsapp\.com/

/**
 * Where `buildDirectContactUrl` may be imported.
 *
 * THE PHASE DOCUMENT'S LIST IS THREE SURFACES, AND IT STILL IS. `DirectContactSource` names them —
 * the announcement bar, the footer and the contact page — and that closed union is what decides who
 * may open a chat with no enquiry to carry. This list is about which FILES hold the call, which is a
 * different question and moves when an implementation is shared.
 *
 * Phase 45 built the `contact-details` block, which needed the footer's contact column exactly:
 * the same `tel:` rule, the same two strings that must resolve before a WhatsApp link may exist,
 * the same location pair. So the column became `ContactChannels` (RC-244) and both surfaces render
 * it — the footer with `source="footer"`, the contact band with `source="contact-page"`. The import
 * moved with the markup; `SiteFooter` no longer holds it, and the section renderer never does.
 *
 * THIS IS NOT A WIDENING. One file replaced one file, the union is unchanged, and a product page
 * that imported `ContactChannels` would still have to pass a `source` the union does not have.
 */
const DIRECT_CONTACT_ALLOWED = new Set([
  join('components', 'patterns', 'AnnouncementBar', 'index.tsx'),
  join('components', 'patterns', 'ContactChannels', 'index.tsx'),
  join('app', '(site)', 'contact', 'page.tsx'),
])

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage'])
const ROOTS = ['app', 'components', 'lib', 'content', 'scripts', 'tests']

/**
 * A TEST IS NOT SHIPPED CODE, and the rule is about what reaches a visitor.
 *
 * `tests/unit/whatsapp-template.test.ts` asserts the exact `wa.me` URL the builder produces and
 * imports `buildDirectContactUrl` to check that it carries no enquiry data — both of which this
 * gate would otherwise report, and neither of which is a bypass of anything. Exempting the test
 * tree is what lets the rule be tested at all; the alternative is a gate nobody can write a test
 * for, which is how a gate comes to be believed rather than known.
 *
 * `scripts/` is NOT exempt: a script that builds a WhatsApp link is real code with real output.
 */
function isTestFile(rel) {
  return rel.startsWith('tests' + sep) || /\.(test|spec)\.[cm]?[jt]sx?$/u.test(rel)
}
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  /** @type {string[]} */
  const found = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return found
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...walk(full))
    else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) found.push(full)
  }
  return found
}

const violations = []

for (const root of ROOTS) {
  for (const file of walk(join(ROOT, root))) {
    const rel = relative(ROOT, file)
    const source = readFileSync(file, 'utf8')

    // This gate itself names both hosts in its own header; skipping it by path is clearer than
    // contorting the regex so that it cannot match its own documentation.
    const isThisFile = rel === join('scripts', 'site', 'check-whatsapp-usage.mjs')
    if (isTestFile(rel)) continue

    if (!rel.startsWith(MODULE_PREFIX) && !isThisFile) {
      /*
       * `{ strings: false }` — COMMENTS GO, STRING LITERALS STAY, and the distinction is the whole
       * check. A WhatsApp host in real code is always inside a string: it is an `href`. Blanking
       * strings, which is this helper's default, erases precisely the thing being looked for — a
       * planted `https://wa.me/...` then passes the gate silently, which is how it behaved before
       * this option was passed. Comments must still go, or the doc comments explaining the rule
       * report themselves.
       */
      const stripped = stripCommentsAndStrings(source, { strings: false })
      if (HOSTS.test(stripped)) {
        violations.push(`${rel}: a WhatsApp host literal outside lib/whatsapp/**`)
      }
    }

    if (rel.startsWith(MODULE_PREFIX) || DIRECT_CONTACT_ALLOWED.has(rel) || isThisFile) continue
    /*
     * An actual named import, not a mention. Raw source, because an import specifier is a string
     * literal and the stripped form would have none left — and matching the bare identifier would
     * report every file that discusses the rule, this one included.
     */
    if (/import\s*\{[^}]*\bbuildDirectContactUrl\b[^}]*\}/s.test(source)) {
      violations.push(
        `${rel}: buildDirectContactUrl may be imported only by the announcement bar, the footer and /contact`,
      )
    }
  }
}

if (violations.length > 0) {
  console.error('✗ WhatsApp usage violations:\n')
  for (const violation of violations) console.error(`    ${violation}`)
  console.error('')
  console.error('  Every WhatsApp link is built by lib/whatsapp. A conversion that carries an')
  console.error('  enquiry uses buildHandoffUrl, which cannot be called without a persisted id.')
  process.exit(1)
}

console.log('✓ WhatsApp usage: no host literals outside lib/whatsapp, no unsanctioned direct links')
