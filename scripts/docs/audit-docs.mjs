#!/usr/bin/env node
/**
 * THE DOCUMENTATION COMPLETENESS AUDIT — Phase 46, verification steps 1 and 9.
 *
 * WHY THIS EXISTS. Phase 46 is the handoff phase, and its own goal statement says the thing this
 * script is for: *a document that claims a capability the code does not have is worse than no
 * document*. Everything below is one of five ways that happens, each caught mechanically rather
 * than by a reviewer remembering to look:
 *
 *   D7 COMPLETENESS   A path the binding contract lists does not exist. D7 is the documentation
 *                     map; a missing file means somebody deleted or renamed a document and left
 *                     the contract describing a repository that is no longer this one.
 *   FRONT MATTER      A document with no machine-readable status. Front matter is what lets a
 *                     reader — and this gate — tell a finished document from a placeholder
 *                     without reading all of it.
 *   STUB DETECTION    A stub with no owning phase. A stub is a promise; without a phase number it
 *                     is a promise with no address, which is an empty page with a title.
 *   SECRET SCAN       A value for a D8 server-only variable, committed into documentation. The
 *                     documents NAME these variables constantly and must keep doing so; what they
 *                     must never carry is a value.
 *   PHASE HONESTY     A `status: CURRENT` document owned by a phase the roadmap says is not
 *                     complete. That is the aspirational document Phase 46 exists to remove.
 *
 * THE D7 LIST IS DERIVED, NEVER COPIED. `parseD7Map` reads the fenced block under "## D7 —
 * Documentation map (fixed)" out of `docs/architecture/CANONICAL-DECISIONS.md` at runtime and
 * expands it. Hand-copying the list into this file would create exactly the drift this phase
 * exists to prevent: the contract would say one thing, the gate would enforce another, and both
 * would look green. The same argument applies to D8 — `parseD8ServerOnly` derives the never-expose
 * names from the contract, so an amendment that adds a variable extends the secret scan for free.
 *
 * THE SECRET SCAN NEVER PRINTS WHAT IT FOUND. It prints the file, the line, the rule that caught
 * the token and the token's LENGTH. A gate that echoes the secret it found has copied it into
 * every CI log, every terminal scrollback and every bug report that quotes the failure — which is
 * a wider distribution than the document it was objecting to. D8 says "never a value, prefix or
 * length"; the length of a *rejected candidate* is printed because without it the message is
 * unactionable, and by the time it prints, the finding is that the line must be deleted anyway.
 *
 * `--claims` IS THE SECOND MODE, AND IT IS NOT A GREP. Phase 46 verification step 9 asks for a
 * scan of a fixed vocabulary — award, certified, certification, testimonial, client, years of
 * experience, guaranteed, delivered project, durability, sales — and says in so many words that a
 * plain grep cannot do it, "because these documents legitimately use every one of those words
 * while forbidding them". `docs/project/BUSINESS_RULES.md` has a *Deliberately not built* table,
 * D10 forbids fabricating an award, and the phase documents quote both. So every hit is
 * CLASSIFIED, and only an unqualified hit fails:
 *
 *   NOT PROSE     The hit is inside a fenced code block, inside a backticked span, part of an
 *                 identifier or a path (`client_consent`, `/studio/content/testimonials`), or
 *                 wrapped in emphasis or quotes (*client*) — which is a word being NAMED rather
 *                 than a fact being asserted.
 *   SYSTEM        The term is the name of something this repository HAS: the `testimonials` table,
 *                 the `client_consent` column, the Studio surface that edits them. A row in a
 *                 table of editing surfaces is documentation of the CMS, not a claim about the
 *                 business. Only the two terms that name real schema objects — `testimonial` and
 *                 `client` — can be classified this way, and only when the line carries no
 *                 business word at all, or carries the route or path of the surface it describes.
 *   PROHIBITED    The hit's BLOCK carries a prohibition marker. This is the common case and the
 *                 whole reason the classifier exists.
 *   ASSERTION     Everything else. Reported as path:line with the term and the line, and the run
 *                 exits 1.
 *
 * WHAT A BLOCK IS — the definition matters, so it is stated rather than left to be inferred from
 * the code. A hit's block is:
 *
 *   1. the contiguous run of non-blank lines containing the hit (a paragraph, a list, or a whole
 *      Markdown table including its header row), plus
 *   2. the nearest preceding Markdown heading, within 200 lines, plus
 *   3. if the hit line is itself a heading, the next contiguous run of non-blank lines.
 *
 * (2) is what lets a row inside a *Deliberately not built* table pass on the table's own heading —
 * the prohibition is stated once, at the top, and repeating it in thirteen rows would be worse
 * prose. (3) is the same courtesy in the other direction: a heading is a one-line run, and what
 * qualifies it is always the paragraph or table underneath.
 *
 * THERE IS NO EXCEPTIONS FILE, AND THERE WILL NOT BE ONE. `tests/e2e/a11y/axe-sweep.spec.ts` states
 * the repository's position: an exceptions file becomes the place findings go to be forgotten. When
 * this gate is wrong, the classifier is wrong and is fixed here, in the open, with the reason
 * written down.
 *
 * WHAT THIS SCRIPT IS NOT. It does not check that a documented capability names its implementing
 * file or route — that is the other half of Phase 46's claim work and it lives in
 * `scripts/docs/check-doc-contract.mjs --claims`, beside the environment-variable contract it
 * already enforces. Two scripts because they answer different questions with different blast
 * radii: `check-doc-contract.mjs` is gate 5 of `scripts/ops/preflight.ts` and runs inside
 * `npm run check` on every commit, and this one walks all of `docs/**` twice.
 *
 * ITS LIMITS, WRITTEN DOWN RATHER THAN LEFT TO BE DISCOVERED. It reads Markdown under `docs/` and
 * nothing else. The D7 map's five ROOT documents (`CLAUDE.md`, `README.md`, `PROJECT_STATE.md`,
 * `CONTEXT.md`, `CHANGELOG.md`) are checked for EXISTENCE only — they carry no front matter and
 * never have. A screenshot under `docs/` cannot be scanned at all: what keeps an environment value
 * out of a runbook image is Phase 46's own rule that the screenshots are taken against the fixture
 * database, and that is a procedure, not a gate. And nothing here reads the database: a document
 * asserting a row count is prose to this script, which is why the owner-verification backlog is
 * GENERATED by `scripts/content/build-verification-report.ts` instead of being checked here.
 *
 * USAGE
 *   node scripts/docs/audit-docs.mjs            # D7, front matter, stubs, secrets, phase honesty
 *   node scripts/docs/audit-docs.mjs --claims   # the claim-term scan
 *
 * Exit 1 on any problem in the mode that was asked for; exit 0 having said what it checked.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const CONTRACT_PATH = 'docs/architecture/CANONICAL-DECISIONS.md'
export const ROADMAP_PATH = 'docs/project/ROADMAP.md'
export const DOCS_DIR = 'docs'

/**
 * `docs/requirements/**` are the two specifications of record. D7 says "never edited" and the
 * documentation-update contract makes a change to them a hard failure, so they cannot be given
 * front matter and are not scanned for claims — they are history, not this repository's assertions.
 */
export const READ_ONLY_PREFIX = 'docs/requirements/'

/**
 * Documents that predate the front-matter convention.
 *
 * `docs/SESSION-STATE.md` is rewritten at the end of every phase and has never carried front
 * matter; Phase 01's verification step 4 lists it among the files still owed one. The exclusion is
 * therefore conditional rather than permanent: the moment the file opens with `---` it is checked
 * like every other document, so whoever adds front matter to it does not also have to find and
 * delete this line.
 */
export const PREDATES_FRONT_MATTER = ['docs/SESSION-STATE.md']

/** Phase 01 fixed the five keys. A document missing any one of them is reported by key name. */
export const FRONT_MATTER_KEYS = [
  'doc',
  'status',
  'owning_phase',
  'last_reviewed',
  'owner_verification',
]

/**
 * The accepted `status` values, and why there are four rather than three.
 *
 * `CURRENT` is the only value in use across `docs/` today. Phase 46 names `STUB`; Phase 01's own
 * front-matter template names `DRAFT`; both mean "not finished, owned by a named phase" and both
 * are accepted, because a gate that rejects the value its own contract's template prints would be
 * wrong about the contract rather than about the document. `SUPERSEDED` is the third state a
 * document can honestly be in.
 */
export const STATUS_VALUES = ['CURRENT', 'STUB', 'DRAFT', 'SUPERSEDED']

/** The unfinished states. Each must name the phase that owes the finished document. */
export const UNFINISHED_STATUSES = ['STUB', 'DRAFT']

/** A roadmap status counts as incomplete when it carries one of these words. */
const INCOMPLETE_WORDS = ['PARTIAL', 'PLANNED', 'NOT STARTED', 'IN PROGRESS', 'BLOCKED', 'TODO']

/* ------------------------------------------------------------------ the file walk ------------- */

/** Every `.md` file under `docs/`, as repository-relative POSIX paths, sorted. */
export function listDocFiles(root, dir = DOCS_DIR, out = []) {
  for (const entry of readdirSync(join(root, dir)).sort()) {
    const rel = `${dir}/${entry}`
    if (statSync(join(root, rel)).isDirectory()) listDocFiles(root, rel, out)
    else if (rel.endsWith('.md')) out.push(rel)
  }
  return out
}

/* ------------------------------------------------------- (a) the D7 documentation map ---------- */

/**
 * Expand one brace group, recursively, so `docs/project/{ROADMAP.md,phases/*.md}` becomes two
 * patterns. Members may themselves contain a slash or a glob; nothing else about them is assumed.
 */
export function expandBraces(pattern) {
  const open = pattern.indexOf('{')
  if (open === -1) return [pattern]
  let depth = 0
  let close = -1
  for (let i = open; i < pattern.length; i += 1) {
    if (pattern[i] === '{') depth += 1
    else if (pattern[i] === '}') {
      depth -= 1
      if (depth === 0) {
        close = i
        break
      }
    }
  }
  if (close === -1) return [pattern]
  const prefix = pattern.slice(0, open)
  const suffix = pattern.slice(close + 1)
  const members = []
  let current = ''
  depth = 0
  for (const character of pattern.slice(open + 1, close)) {
    if (character === '{') depth += 1
    if (character === '}') depth -= 1
    if (character === ',' && depth === 0) {
      members.push(current)
      current = ''
      continue
    }
    current += character
  }
  members.push(current)
  return members.flatMap((member) => expandBraces(`${prefix}${member.trim()}${suffix}`))
}

/**
 * Derive the D7 path list from the contract.
 *
 * The block is prose-shaped, not machine-shaped, and every one of its habits is handled here
 * rather than asked of whoever edits it next: `·` separators, brace groups, a brace group split
 * across two lines with the continuation indented, glob suffixes (`phases/*.md`,
 * `docs/requirements/*`) and a trailing comment after two or more spaces ("specifications of
 * record, never edited", "(amendment A31)").
 *
 * A comment is only cut when the braces are balanced at that point — otherwise the indentation of
 * a continuation line would be read as the start of a comment and half a brace group would be
 * thrown away.
 */
export function parseD7Map(contractText) {
  const lines = contractText.split('\n')
  const start = lines.findIndex((line) => /^##\s+D7\b/.test(line))
  if (start === -1) throw new Error(`${CONTRACT_PATH}: no "## D7" heading — the contract moved`)
  let fenceStart = -1
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s/.test(lines[i])) break
    if (/^\s*```/.test(lines[i])) {
      fenceStart = i
      break
    }
  }
  if (fenceStart === -1) throw new Error(`${CONTRACT_PATH}: D7 has no fenced block`)

  const logical = []
  let buffer = ''
  for (let i = fenceStart + 1; i < lines.length; i += 1) {
    const raw = lines[i]
    if (/^\s*```/.test(raw)) break
    const trimmed = raw.trim()
    if (trimmed === '') continue
    let text = trimmed
    if (buffer === '') {
      const comment = /\s{2,}/.exec(text)
      if (comment !== null) {
        const head = text.slice(0, comment.index)
        const balanced = (head.match(/\{/g) ?? []).length === (head.match(/\}/g) ?? []).length
        if (balanced) text = head
      }
    }
    buffer += text
    const balanced = (buffer.match(/\{/g) ?? []).length === (buffer.match(/\}/g) ?? []).length
    if (!balanced) continue
    logical.push(buffer)
    buffer = ''
  }
  if (buffer !== '') logical.push(buffer)

  const patterns = []
  for (const line of logical) {
    for (const token of line.split('·')) {
      const candidate = token.trim()
      if (candidate === '') continue
      for (const expanded of expandBraces(candidate)) {
        const path = expanded.trim()
        if (path !== '' && !patterns.includes(path)) patterns.push(path)
      }
    }
  }
  return patterns
}

/**
 * Does a D7 pattern resolve on disk? An exact path must exist. A glob must match at least one
 * file — "at least one" is the right reading of `phases/*.md`, which promises a directory of phase
 * documents rather than a fixed set of names.
 */
export function resolvesOnDisk(root, pattern) {
  if (!pattern.includes('*')) return existsSync(join(root, pattern))
  const slash = pattern.lastIndexOf('/')
  const dir = slash === -1 ? '.' : pattern.slice(0, slash)
  const glob = slash === -1 ? pattern : pattern.slice(slash + 1)
  if (!existsSync(join(root, dir))) return false
  const matcher = new RegExp(
    `^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`,
  )
  return readdirSync(join(root, dir)).some((entry) => matcher.test(entry))
}

export function checkD7Completeness(root) {
  const contractText = readFileSync(join(root, CONTRACT_PATH), 'utf8')
  const patterns = parseD7Map(contractText)
  const problems = []
  for (const pattern of patterns) {
    if (resolvesOnDisk(root, pattern)) continue
    problems.push(
      `${pattern} is in the D7 documentation map and ${pattern.includes('*') ? 'matches no file' : 'does not exist'}.\n` +
        `      D7 is the binding list. Either the document was lost, or it was renamed and the\n` +
        `      contract was not amended — ${CONTRACT_PATH}, "## D7".`,
    )
  }
  return { patterns, problems }
}

/* ------------------------------------------- (b) and (c) front matter and stub detection ------- */

/**
 * Parse a front-matter block. The first line must be exactly `---` — never a `^---` grep, which
 * any horizontal rule in the body satisfies, a trap Phase 01's deliverable table names explicitly.
 *
 * Values are read as flat `key: value` text. This is deliberately not a YAML parser: the five keys
 * are scalars, and a dependency-free gate that cannot be broken by a nested structure nobody
 * intended is worth more here than generality.
 */
export function parseFrontMatter(text) {
  const lines = text.split('\n')
  if (lines[0] !== '---') return { present: false, keys: {} }
  const keys = {}
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') return { present: true, keys }
    const match = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(lines[i])
    if (match !== null) keys[match[1]] = match[2].trim()
  }
  return { present: false, keys, unterminated: true }
}

/** ISO calendar date, and a date that exists: `2026-02-31` is not a review anybody performed. */
export function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

/**
 * A generated document names its generator in its own first lines ("GENERATED by
 * `npm run content:inventory`"), and hand-editing one is pointless because the next run reverts it.
 * So a missing key in a generated file is a finding against the GENERATOR, and the message says so
 * — otherwise the reader's first move is a hand edit that a build gate then undoes.
 * `scripts/demo/build-register.ts` is the worked example: it writes its document's front matter.
 */
export function generatorOf(text) {
  // The first backticked command within reach of the word GENERATED. Both house phrasings are
  // covered: "GENERATED by `npm run content:inventory`" and "**GENERATED — do not edit.** `npm run
  // demo:register` rewrites this file".
  return /GENERATED[^`]{0,60}`([^`]+)`/i.exec(text.slice(0, 800))?.[1] ?? null
}

export function frontMatterProblems(path, text) {
  const problems = []
  const parsed = parseFrontMatter(text)
  if (!parsed.present) {
    problems.push(
      parsed.unterminated === true
        ? `${path}: the front-matter block opens with --- and is never closed.`
        : `${path}: no front matter. The first line must be exactly --- followed by ${FRONT_MATTER_KEYS.join(', ')}.`,
    )
    return withGeneratorNote(problems, text)
  }
  for (const key of FRONT_MATTER_KEYS) {
    const value = parsed.keys[key]
    if (value === undefined || value === '')
      problems.push(`${path}: front matter is missing "${key}".`)
  }
  const status = parsed.keys['status']
  if (status !== undefined && status !== '' && !STATUS_VALUES.includes(status)) {
    problems.push(`${path}: status "${status}" is not one of ${STATUS_VALUES.join(', ')}.`)
  }
  const reviewed = parsed.keys['last_reviewed']
  if (reviewed !== undefined && reviewed !== '' && !isIsoDate(reviewed)) {
    problems.push(`${path}: last_reviewed "${reviewed}" is not an ISO date (YYYY-MM-DD).`)
  }
  const phase = parsed.keys['owning_phase']
  if (phase !== undefined && phase !== '' && !/^\d{1,2}$/.test(phase)) {
    problems.push(`${path}: owning_phase "${phase}" is not a phase number (00–46).`)
  }
  if (status !== undefined && UNFINISHED_STATUSES.includes(status)) {
    if (phase === undefined || phase === '' || !/^\d{1,2}$/.test(phase)) {
      problems.push(
        `${path}: status ${status} with no owning phase. A stub is a promise; without a phase\n` +
          `      number it has no address, and nobody knows who owes the finished document.`,
      )
    }
  }
  return withGeneratorNote(problems, text)
}

/**
 * Add the generator note once, at the end, when a generated document has any front-matter problem.
 *
 * Said once rather than per key: the action is the same for all of them, and repeating it five times
 * would bury the list of keys it is telling you to add.
 */
function withGeneratorNote(problems, text) {
  if (problems.length === 0) return problems
  const generator = generatorOf(text)
  if (generator === null) return problems
  problems.push(
    `      ↳ this document is GENERATED by \`${generator}\`: put the front matter in the generator\n` +
      `      (as \`scripts/demo/build-register.ts\` does for DEMO_CONTENT.md) and regenerate. A hand\n` +
      `      edit here is reverted by the next run, and by the check that compares the two.`,
  )
  return problems
}

/** The documents front matter is required on: everything under docs/ bar the two exclusions. */
export function frontMatterTargets(root) {
  return listDocFiles(root).filter((path) => {
    if (path.startsWith(READ_ONLY_PREFIX)) return false
    if (!PREDATES_FRONT_MATTER.includes(path)) return true
    // Conditional exclusion: the moment the file carries front matter, it is checked like any other.
    return readFileSync(join(root, path), 'utf8').startsWith('---\n')
  })
}

export function checkFrontMatter(root) {
  const targets = frontMatterTargets(root)
  const problems = []
  for (const path of targets) {
    problems.push(...frontMatterProblems(path, readFileSync(join(root, path), 'utf8')))
  }
  return { targets, problems }
}

/* ----------------------------------------------------------------- (d) the secret scan --------- */

/**
 * The never-expose names, derived from D8's "Server-only:" paragraph rather than copied.
 *
 * The paragraph is prose: backticked names, commas, line wraps and parenthetical notes about which
 * amendment added which variable. Only the backticked ALL_CAPS tokens are taken, which is why the
 * note "(added by amendment A25 — see below)" costs nothing.
 */
export function parseD8ServerOnly(contractText) {
  const lines = contractText.split('\n')
  const start = lines.findIndex((line) => /^##\s+D8\b/.test(line))
  if (start === -1) throw new Error(`${CONTRACT_PATH}: no "## D8" heading — the contract moved`)
  let paragraph = ''
  let seen = false
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s/.test(lines[i])) break
    if (/^Server-only:/.test(lines[i])) seen = true
    else if (seen && lines[i].trim() === '') break
    if (seen) paragraph += `${lines[i]}\n`
  }
  const names = []
  for (const match of paragraph.matchAll(/`([A-Z][A-Z0-9_]{2,})`/g)) {
    if (!names.includes(match[1])) names.push(match[1])
  }
  if (names.length === 0) throw new Error(`${CONTRACT_PATH}: D8 names no server-only variables`)
  return names
}

/**
 * Placeholder shapes that must PASS. A document explaining how to set a variable has to show the
 * shape of what goes there, and every one of these says "not a real value" to a reader:
 * `<password>`, `...`, `your-key`, `example`, `REDACTED`, `xxx`, `TO_BE_PROVIDED`, `$CRON_SECRET`.
 */
const PLACEHOLDER = [
  /^[\s'"`]*[<{[]/,
  /^[\s'"`]*\$/,
  /^[\s'"`]*(?:\.{2,}|…|-{3,}$)/,
  /\b(?:your|example|sample|redacted|placeholder|changeme|dummy|fake|sentinel|to_be_provided|waiting_for_upload)\b/i,
  /x{3,}/i,
]

export function isPlaceholder(value) {
  return PLACEHOLDER.some((shape) => shape.test(value))
}

/**
 * The words a document uses where a connection string's credentials would be. `postgres://user:pass@`
 * is how `SECURITY.md`, `ARCHITECTURE.md` and `ENVIRONMENT.md` all describe the shape the redactor
 * strips — six honest lines that a rule reading `user:pass` as a credential would fail forever.
 */
const CREDENTIAL_PLACEHOLDER = /^(?:pass(?:word)?|user(?:name)?|secret|token|key|credentials?)$/i

/**
 * The shape rules. Each is a thing a REAL credential looks like; each returns the token it matched
 * so the caller can report its LENGTH, and each names itself so the finding is actionable without
 * the value ever being printed.
 *
 * `long digit run` is the Cloudinary API key (fifteen digits) and is the reason there is no
 * length-only rule: `CSP_ENFORCE=1` is a documented switch setting, not a credential, and a rule
 * that failed every non-empty value would fail three honest lines in `SECURITY.md` on its first run.
 *
 * The PEM rule wants the literal armour, `-----BEGIN [TYPE] PRIVATE KEY-----`, and not the mere
 * word BEGIN: four documents write `-----BEGIN … PRIVATE KEY-----`, with the ellipsis, precisely
 * because they are describing the shape rather than carrying one.
 */
const SHAPE_RULES = [
  {
    rule: 'PEM private-key block',
    match: (value) => /-----BEGIN [A-Z ]*PRIVATE KEY-----/.exec(value)?.[0] ?? null,
  },
  { rule: 'JWT (eyJ…)', match: (value) => /\beyJ[A-Za-z0-9_-]{10,}/.exec(value)?.[0] ?? null },
  {
    rule: 'Supabase key prefix (sb_…)',
    match: (value) => /\bsb_[a-z]+_[A-Za-z0-9_-]{10,}/.exec(value)?.[0] ?? null,
  },
  {
    rule: 'connection URL carrying a password',
    match: (value) => {
      const found = /\b(?:postgres|postgresql):\/\/[^\s:@/]+:([^\s@/]+)@/.exec(value)
      if (found === null) return null
      const password = found[1]
      if (CREDENTIAL_PLACEHOLDER.test(password) || isPlaceholder(password)) return null
      return found[0]
    },
  },
  {
    rule: 'long digit run (API-key shaped)',
    match: (value) => /(?<![\d.])\d{12,}(?![\d.])/.exec(value)?.[0] ?? null,
  },
  {
    rule: '20+ characters of base64/hex',
    match: (value) => {
      for (const found of value.matchAll(/[A-Za-z0-9+/=_-]{20,}/g)) {
        const token = found[0]
        if (!/\d/.test(token) || !/[A-Za-z]/.test(token)) continue
        // An ALL_CAPS_NAME is a variable name, not a value: OWNER_VERIFICATION_REQUIRED is 27 long.
        if (/^[A-Z0-9_]+$/.test(token)) continue
        // A word-with-a-number (`rivya-hf-v1`, `PHASE-39-46`) is not a key: keys mix both cases,
        // are long hex, or carry base64 punctuation.
        const mixedCase = /[a-z]/.test(token) && /[A-Z]/.test(token)
        const longHex = token.length >= 32 && /^[0-9a-f]+$/i.test(token)
        const base64ish = /[+/=]/.test(token) && token.length >= 24
        if (mixedCase || longHex || base64ish) return token
      }
      return null
    },
  },
]

/** The four shapes that are a secret whatever names them, and are therefore scanned unanchored. */
const UNANCHORED_RULES = SHAPE_RULES.slice(0, 4)

/**
 * Scan one document for a committed value.
 *
 * Two families, and the difference matters. NAME-ANCHORED: a D8 name followed by `=` or `:` and
 * then a token — the value position. UNANCHORED: a PEM block, a JWT, an `sb_` key or a connection
 * string with a password anywhere in the file, because those shapes are secrets whatever names
 * them. The entropy rules are anchored only: twenty characters of mixed-case base64 appear in this
 * repository's own asset IDs, hashes and Cloudinary public IDs, and an unanchored entropy rule
 * reports them forever.
 *
 * Returns hits as `{ line, name, rule, length }`. THE MATCHED TEXT IS NEVER RETURNED, so no caller
 * can print it by accident — only how long it was.
 */
export function scanSecrets(text, names) {
  const hits = []
  const lines = text.split('\n')
  const anchored = new RegExp(`(${names.join('|')})\`?\\s*[:=]\\s*(\\S.*)$`)
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const anchor = anchored.exec(line)
    if (anchor !== null) {
      const value = anchor[2].trim()
      if (!isPlaceholder(value)) {
        for (const { rule, match } of SHAPE_RULES) {
          const found = match(value)
          if (found === null) continue
          hits.push({ line: i + 1, name: anchor[1], rule, length: found.length })
          break
        }
      }
    }
    if (hits.some((hit) => hit.line === i + 1)) continue
    for (const { rule, match } of UNANCHORED_RULES) {
      const found = match(line)
      if (found === null) continue
      hits.push({ line: i + 1, name: 'no name — the shape alone', rule, length: found.length })
      break
    }
  }
  return hits
}

export function checkSecrets(root) {
  const names = parseD8ServerOnly(readFileSync(join(root, CONTRACT_PATH), 'utf8'))
  const problems = []
  const scanned = listDocFiles(root).filter((path) => !path.startsWith(READ_ONLY_PREFIX))
  for (const path of scanned) {
    for (const hit of scanSecrets(readFileSync(join(root, path), 'utf8'), names)) {
      problems.push(
        `${path}:${hit.line} carries a value-shaped token (${hit.name}; rule: ${hit.rule};\n` +
          `      ${String(hit.length)} characters — the value is deliberately not printed).\n` +
          `      D8: names are documented, values are never committed. Delete the value, or replace\n` +
          `      it with a placeholder in angle brackets.`,
      )
    }
  }
  return { names, scanned, problems }
}

/* ------------------------------------------------- (e) no CURRENT document owned by a gap ------ */

/**
 * Read the phase statuses out of the roadmap's 47-phase table, DEFENSIVELY.
 *
 * The table is the orchestrating document for the whole build and its shape changes: Phase 46 adds
 * a Status column to it. So the column is found by its header name, never by position, and when
 * there is no status column at all the answer is `supported: false` with the reason — a SKIP that
 * says what it did not do. Inventing a status, or failing because the table has not caught up yet,
 * would both be worse than saying so.
 */
export function parseRoadmapStatuses(roadmapText) {
  const lines = roadmapText.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const header = lines[i]
    if (!/^\|/.test(header)) continue
    const columns = header
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim().toLowerCase())
    if (!columns.includes('phase')) continue
    const statusColumn = columns.findIndex((cell) => cell === 'status')
    const phaseColumn = columns.findIndex((cell) => cell === '#')
    if (statusColumn === -1) {
      return {
        supported: false,
        reason: `${ROADMAP_PATH} line ${String(i + 1)}: the phase table has columns [${columns.join(', ')}] and no "Status" column`,
        statuses: new Map(),
      }
    }
    const statuses = new Map()
    for (let row = i + 2; row < lines.length; row += 1) {
      if (!/^\|/.test(lines[row])) break
      const cells = lines[row].split('|').slice(1, -1)
      const phase = (cells[phaseColumn === -1 ? 0 : phaseColumn] ?? '').replace(/[^\d]/g, '')
      const status = (cells[statusColumn] ?? '').trim()
      if (phase === '' || status === '') continue
      statuses.set(String(Number(phase)), status)
    }
    return { supported: true, statuses }
  }
  return { supported: false, reason: `${ROADMAP_PATH}: no phase table found`, statuses: new Map() }
}

/**
 * Is a roadmap status cell a complete phase?
 *
 * The roadmap's vocabulary is prose, and deliberately so — "CODE COMPLETE; CATALOGUE EMPTY BY
 * DESIGN" and "DEVELOPMENT COMPLETE — tests deferred to Phase 42 by the owner's instruction" both
 * describe a phase whose scope was built. What this check is looking for is the opposite: a
 * document claiming to be CURRENT for work that has not happened. So the rule is the word COMPLETE
 * with none of PARTIAL, PLANNED, NOT STARTED, IN PROGRESS or BLOCKED beside it. "deferred" is
 * deliberately NOT an incomplete word: the deferral is recorded in the roadmap cell itself, which
 * is the honesty this gate wants, and reading it as incomplete would punish the record for existing.
 */
export function isPhaseComplete(statusCell) {
  const text = statusCell.replace(/[*`]/g, '').toUpperCase()
  if (INCOMPLETE_WORDS.some((word) => text.includes(word))) return false
  return /\bCOMPLETE\b/.test(text)
}

export function checkCurrentDocumentsAgainstRoadmap(root) {
  const roadmap = parseRoadmapStatuses(readFileSync(join(root, ROADMAP_PATH), 'utf8'))
  if (!roadmap.supported) return { skipped: roadmap.reason, problems: [], checked: 0 }
  const problems = []
  let checked = 0
  for (const path of frontMatterTargets(root)) {
    const { keys } = parseFrontMatter(readFileSync(join(root, path), 'utf8'))
    if (keys['status'] !== 'CURRENT') continue
    const phase = keys['owning_phase']
    if (phase === undefined || phase === '') continue
    const status = roadmap.statuses.get(String(Number(phase)))
    checked += 1
    if (status === undefined) {
      problems.push(
        `${path}: owning_phase ${phase} is not a row in the ${ROADMAP_PATH} phase table.`,
      )
      continue
    }
    if (isPhaseComplete(status)) continue
    problems.push(
      `${path}: status CURRENT, owning_phase ${phase}, but the roadmap says phase ${phase} is\n` +
        `      "${status.replace(/[*]/g, '').trim()}". A CURRENT document describes what exists; a\n` +
        `      document for work that has not landed is a stub — say STUB, or finish the phase.`,
    )
  }
  return { problems, checked, skipped: null }
}

/* ------------------------------------------------------------------- --claims: the scan -------- */

/** Phase 46 verification step 9 fixes the vocabulary. It is not extended here. */
export const CLAIM_TERMS = [
  'award',
  'certified',
  'certification',
  'testimonial',
  'client',
  'years of experience',
  'guaranteed',
  'delivered project',
  'durability',
  'sales',
]

/**
 * The prohibition markers. The first ten are Phase 46 verification step 9's own list, verbatim.
 *
 * The last two are this repository's own vocabulary for the same thing — "what is named here is not
 * a real business fact" — and each is here because a real block needs it and no marker above
 * reaches it. They are listed separately, with the block they exist for, so the extension is
 * auditable rather than quietly folded into the phase's list. Nothing else was added: a run with
 * only these twelve reports zero assertions, and every further candidate (`zero`, `demo`, `DRAFT`)
 * turned out to be load-bearing for nothing at all, so it is not here.
 *
 *   placeholder   `docs/content/DEMO_CONTENT.md` is the register of placeholder rows, and every row
 *                 it lists carries the word "Placeholder" in the cell beside the term.
 *   nothing       "Nothing in this repository may do any of those on their behalf" — SESSION-STATE
 *                 on portfolio consent. It is a prohibition, and neither `no` nor `not` occurs in it.
 */
export const PROHIBITION_MARKERS = [
  /\bnever\b/i,
  /\bnot\b/i,
  /\bno\b/i,
  /\bforbidden\b/i,
  /fabricat/i,
  /must not/i,
  /out of scope/i,
  /\bD10\b/,
  /OWNER_VERIFICATION_REQUIRED/,
  /deliberately not built/i,
  /\bplaceholder/i,
  /\bnothing\b/i,
]

/**
 * The two terms that also name real schema objects: the `testimonials` table and the
 * `client_display_name` / `client_consent` columns, with the Studio surfaces that edit them. For
 * these, and only these, a hit can be classified SYSTEM.
 */
const ENTITY_TERMS = ['testimonial', 'client']

/**
 * Words that put a hit in a business context. Without one of these on the line, an ENTITY_TERM hit
 * is the schema object: "the harness's client", "`MediaVideo` | Client", "projects 6,
 * testimonials 6" — a database client, a rendering kind and a row count, none of them a claim
 * about anybody Rivya has worked for.
 */
const BUSINESS_CONTEXT =
  /\b(?:customers?|commission|commissions|consent|enquir|inquir|referral|delivered|sold|satisfied|logos?|praise|reviews?)\b/i

/** A Studio surface or repository path on the line: the row documents the editing surface. */
const SURFACE_REFERENCE =
  /\/studio\/[a-z[\]-]+|(?:app|lib|components|scripts|content|supabase|tests)\//

/** Blank out backticked spans: their contents are code, an identifier or a path, never prose. */
function blankCodeSpans(line) {
  return line.replace(/`[^`]*`/g, (span) => ' '.repeat(span.length))
}

/** The block a hit is judged in. The definition is stated in this file's header comment. */
export function blockFor(lines, index) {
  let start = index
  while (start > 0 && lines[start - 1].trim() !== '') start -= 1
  let end = index
  while (end < lines.length - 1 && lines[end + 1].trim() !== '') end += 1
  const parts = []
  for (let i = start - 1; i >= 0 && i > start - 200; i -= 1) {
    if (/^#{1,6}\s/.test(lines[i])) {
      parts.push(lines[i])
      break
    }
  }
  parts.push(...lines.slice(start, end + 1))
  if (/^#{1,6}\s/.test(lines[index])) {
    let next = end + 1
    while (next < lines.length && lines[next].trim() === '') next += 1
    while (next < lines.length && lines[next].trim() !== '') {
      parts.push(lines[next])
      next += 1
    }
  }
  return parts.join('\n')
}

/**
 * Classify every claim-vocabulary hit in one document.
 *
 * Returns one record per hit: `{ line, term, verdict, text }`, with verdict `PROHIBITED`, `SYSTEM`
 * or `ASSERTION`. The fourth class in the header comment, NOT PROSE, is never returned at all —
 * a term inside a fence, a code span, an identifier or a pair of emphasis marks is not a hit, and
 * reporting it as a passed one would bury the twenty findings that matter under four hundred.
 */
export function scanClaims(text) {
  const lines = text.split('\n')
  const hits = []
  let fenced = false
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    if (/^\s*(?:```|~~~)/.test(raw)) {
      fenced = !fenced
      continue
    }
    if (fenced) continue
    const prose = blankCodeSpans(raw)
    for (const term of CLAIM_TERMS) {
      /*
       * `before` is one character and `after` is a two-character LOOKAHEAD, so an occurrence is
       * never consumed and the next one on the same line is still found. Two characters because one
       * is not enough to tell a path from a full stop: `.md` is a file, "an award." is a sentence.
       */
      const pattern = new RegExp(
        `(.?)\\b${term.replace(/ /g, '\\s+')}(?:s|es)?\\b(?=(.{0,2}))`,
        'gi',
      )
      let match
      let verdict = null
      while ((match = pattern.exec(prose)) !== null) {
        const before = match[1] ?? ''
        const after = match[2] ?? ''
        // Part of an identifier or a path: `client_consent`, /studio/content/testimonials, x.md.
        if (/[_/]/.test(before) || /^[_/]/.test(after) || /^\.[A-Za-z0-9]/.test(after)) continue
        // A hyphen on BOTH sides is a slug, not prose: `is-client-project` is a toggle's name,
        // while "client-facing" and "owner-client" are ordinary compounds and stay in.
        if (before === '-' && after.startsWith('-')) continue
        // Named rather than used: *client*, "award", 'sales'.
        if (/[*_"“'‘]/.test(before) && /^[*_"”'’]/.test(after)) continue
        const block = blockFor(lines, i)
        if (PROHIBITION_MARKERS.some((marker) => marker.test(block))) {
          verdict = 'PROHIBITED'
          break
        }
        if (
          ENTITY_TERMS.includes(term) &&
          (!BUSINESS_CONTEXT.test(prose) || SURFACE_REFERENCE.test(raw))
        ) {
          verdict = 'SYSTEM'
          continue
        }
        verdict = 'ASSERTION'
        break
      }
      if (verdict !== null) hits.push({ line: i + 1, term, verdict, text: raw.trim() })
    }
  }
  return hits
}

export function checkClaims(root) {
  const scanned = listDocFiles(root).filter((path) => !path.startsWith(READ_ONLY_PREFIX))
  const counts = { SYSTEM: 0, PROHIBITED: 0, ASSERTION: 0 }
  const problems = []
  for (const path of scanned) {
    for (const hit of scanClaims(readFileSync(join(root, path), 'utf8'))) {
      counts[hit.verdict] += 1
      if (hit.verdict !== 'ASSERTION') continue
      problems.push(
        `${path}:${String(hit.line)} asserts "${hit.term}" with no prohibition in its block:\n` +
          `      ${hit.text.slice(0, 160)}\n` +
          `      D10: never an award, a certification, a testimonial, a named client, a delivered\n` +
          `      project, a durability or a sales claim. If the business fact is real, the owner\n` +
          `      confirms it — seed it OWNER_VERIFICATION_REQUIRED and say so here.`,
      )
    }
  }
  return { scanned, counts, problems }
}

/* --------------------------------------------------------------------------- the CLI ----------- */

function report(label, problems) {
  if (problems.length === 0) return 0
  console.error(`✗ ${label}: ${String(problems.length)} problem(s):\n`)
  for (const problem of problems) console.error(`    ${problem}\n`)
  return problems.length
}

function runDefault(root) {
  let failures = 0

  const d7 = checkD7Completeness(root)
  failures += report('D7 completeness', d7.problems)
  if (d7.problems.length === 0) {
    console.log(`✓ D7 completeness: ${String(d7.patterns.length)} mapped path(s), all present`)
  }

  const frontMatter = checkFrontMatter(root)
  failures += report('front matter', frontMatter.problems)
  if (frontMatter.problems.length === 0) {
    console.log(
      `✓ front matter: ${String(frontMatter.targets.length)} document(s), all five keys, ` +
        `real status, ISO review date, every stub owned`,
    )
  }

  const secrets = checkSecrets(root)
  failures += report('secret scan', secrets.problems)
  if (secrets.problems.length === 0) {
    console.log(
      `✓ secret scan: ${String(secrets.scanned.length)} document(s) × ` +
        `${String(secrets.names.length)} D8 server-only name(s), no value committed`,
    )
  }

  const phases = checkCurrentDocumentsAgainstRoadmap(root)
  if (phases.skipped !== null) {
    console.log(`- phase honesty: SKIPPED — ${phases.skipped}`)
  } else {
    failures += report('phase honesty', phases.problems)
    if (phases.problems.length === 0) {
      console.log(
        `✓ phase honesty: ${String(phases.checked)} CURRENT document(s), every owning phase complete`,
      )
    }
  }

  return failures
}

function runClaims(root) {
  const claims = checkClaims(root)
  const failures = report('claim vocabulary', claims.problems)
  if (failures === 0) {
    console.log(
      `✓ claim vocabulary: ${String(claims.scanned.length)} document(s), ` +
        `${String(claims.counts.PROHIBITED)} hit(s) inside a prohibition, ` +
        `${String(claims.counts.SYSTEM)} naming a schema object or a Studio surface, 0 assertions`,
    )
  }
  return failures
}

function main(argv) {
  const root = process.cwd()
  const claims = argv.includes('--claims')
  const failures = claims ? runClaims(root) : runDefault(root)
  if (failures > 0) process.exit(1)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2))
}
