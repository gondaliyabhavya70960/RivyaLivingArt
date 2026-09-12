import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  CLAIM_TERMS,
  CONTRACT_PATH,
  FRONT_MATTER_KEYS,
  checkD7Completeness,
  expandBraces,
  frontMatterProblems,
  generatorOf,
  isIsoDate,
  isPhaseComplete,
  parseD7Map,
  parseD8ServerOnly,
  parseFrontMatter,
  parseRoadmapStatuses,
  resolvesOnDisk,
  scanClaims,
  scanSecrets,
} from '../../scripts/docs/audit-docs.mjs'

/**
 * The documentation gate, tested where it can lie — Phase 46.
 *
 * `scripts/docs/audit-docs.mjs` is the only mechanical check on the documentation set, and a broken
 * gate is worse than no gate: it prints a tick. Each suite below is one way it could print a tick it
 * had not earned.
 *
 * THE PARSER IS TESTED ON A FIXTURE STRING FIRST. D7's block is prose — `·` separators, brace
 * groups, a group split across two lines, glob suffixes, trailing comments — and if the expander
 * silently dropped half of it the completeness check would pass by checking almost nothing. The
 * fixture states what the shapes are; the second test then runs the real contract against the real
 * repository, which is the rule itself rather than a model of it.
 *
 * THE SECRET SCANNER IS TESTED WITH A SYNTHETIC VALUE. Every "real-looking" string below was typed
 * here for this test. Nothing in this file is, or has ever been, a credential — which is also why
 * the assertions check the LENGTH the scanner reports and never a value.
 *
 * IT IS OFFLINE. No database, no network, no Supabase client: `npm run db:check-unit-offline`
 * enforces that for the `unit` project, and everything here is a string or a file read.
 */

const ROOT = process.cwd()

/** The fixture: every shape D7 actually uses, in the order the contract uses them. */
const D7_FIXTURE = [
  '## D7 — Documentation map (fixed)',
  '',
  '```',
  'CLAUDE.md · PROJECT_STATE.md · CONTEXT.md',
  'docs/SESSION-STATE.md',
  'docs/PHASE_31_TO_46_IMPLEMENTATION.md · docs/ASSET_GENERATION_PROMPTS.md   (amendment A31)',
  'docs/project/{ROADMAP.md,PRD.md,phases/*.md}',
  'docs/media/{MEDIA_GUIDE.md,CLOUDINARY.md,',
  '            HIGGSFIELD_GUIDE.md}',
  'docs/requirements/*                     specifications of record, never edited',
  '```',
  '',
  '## D8 — next section',
].join('\n')

describe('the D7 parser', () => {
  it('expands brace groups, joins a continuation line and strips a trailing comment', () => {
    expect(parseD7Map(D7_FIXTURE)).toEqual([
      'CLAUDE.md',
      'PROJECT_STATE.md',
      'CONTEXT.md',
      'docs/SESSION-STATE.md',
      'docs/PHASE_31_TO_46_IMPLEMENTATION.md',
      'docs/ASSET_GENERATION_PROMPTS.md',
      'docs/project/ROADMAP.md',
      'docs/project/PRD.md',
      'docs/project/phases/*.md',
      'docs/media/MEDIA_GUIDE.md',
      'docs/media/CLOUDINARY.md',
      'docs/media/HIGGSFIELD_GUIDE.md',
      'docs/requirements/*',
    ])
  })

  it('expands a brace group whose members carry their own path segment', () => {
    expect(expandBraces('docs/a/{b.md,c/d.md}')).toEqual(['docs/a/b.md', 'docs/a/c/d.md'])
    expect(expandBraces('no/braces/here.md')).toEqual(['no/braces/here.md'])
  })

  /*
   * A glob promises "at least one file", which is the right reading of `phases/*.md`: the contract
   * promises a directory of phase documents, not a fixed set of names. The negative case is the one
   * that matters — a pattern matching nothing has to be a failure, or a deleted document is silent.
   */
  it('treats a glob as at least one match and a missing directory as none', () => {
    expect(resolvesOnDisk(ROOT, 'docs/project/phases/*.md')).toBe(true)
    expect(resolvesOnDisk(ROOT, 'docs/architecture/ARCHITECTURE.md')).toBe(true)
    expect(resolvesOnDisk(ROOT, 'docs/nowhere/*.md')).toBe(false)
    expect(resolvesOnDisk(ROOT, 'docs/architecture/NOT_A_DOCUMENT.md')).toBe(false)
  })

  it('every path the real D7 map names exists in this repository', () => {
    const { patterns, problems } = checkD7Completeness(ROOT)
    // A parser that found nothing would report no problems, which is the failure mode to exclude.
    expect(patterns.length).toBeGreaterThan(25)
    expect(patterns).toContain('docs/PHASE_31_TO_46_IMPLEMENTATION.md')
    expect(patterns).toContain('docs/ASSET_GENERATION_PROMPTS.md')
    expect(problems).toEqual([])
  })
})

describe('front matter', () => {
  const valid = [
    '---',
    'doc: EXAMPLE',
    'status: CURRENT',
    'owning_phase: 46',
    'last_reviewed: 2026-09-12',
    'owner_verification: NOT_REQUIRED',
    '---',
    '',
    '# Example',
  ].join('\n')

  it('accepts a complete block', () => {
    const parsed = parseFrontMatter(valid)
    expect(parsed.present).toBe(true)
    expect(Object.keys(parsed.keys)).toEqual([...FRONT_MATTER_KEYS])
    expect(frontMatterProblems('docs/example.md', valid)).toEqual([])
  })

  /*
   * Phase 01's deliverable table names this trap by name: never `grep '^---'`, which any horizontal
   * rule in the body satisfies. A document whose body happens to contain a rule must still fail.
   */
  it('is not satisfied by a horizontal rule further down the document', () => {
    const body = ['# Example', '', 'Some prose.', '', '---', '', 'More prose.'].join('\n')
    expect(parseFrontMatter(body).present).toBe(false)
    expect(frontMatterProblems('docs/example.md', body)[0]).toContain('no front matter')
  })

  it('names the missing key rather than saying "invalid"', () => {
    const missing = valid
      .split('\n')
      .filter((line) => !line.startsWith('owning_phase'))
      .join('\n')
    const problems = frontMatterProblems('docs/example.md', missing)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('missing "owning_phase"')
  })

  it('rejects a status outside the vocabulary and a review date that is not ISO', () => {
    const badStatus = valid.replace('status: CURRENT', 'status: NEARLY')
    expect(frontMatterProblems('docs/example.md', badStatus)[0]).toContain('is not one of')
    const badDate = valid.replace('last_reviewed: 2026-09-12', 'last_reviewed: 12 September 2026')
    expect(frontMatterProblems('docs/example.md', badDate)[0]).toContain('not an ISO date')
    expect(isIsoDate('2026-09-12')).toBe(true)
    expect(isIsoDate('2026-02-31')).toBe(false)
  })

  /*
   * A generated document is fixed in its generator, never by hand — `content:check-inventory` and
   * `demo:check-register` both regenerate and fail on a diff, so a hand edit is reverted rather than
   * kept. The finding has to say that, or the first thing the reader does is the thing that fails.
   */
  it('points a generated document at its generator instead of at itself', () => {
    expect(generatorOf('> GENERATED by `npm run content:inventory`. Do not edit by hand.')).toBe(
      'npm run content:inventory',
    )
    expect(
      generatorOf('**GENERATED — do not edit.** `npm run demo:register` rewrites this file.'),
    ).toBe('npm run demo:register')
    expect(generatorOf('# A hand-written document\n\nProse.')).toBeNull()

    const generated = ['# Register', '', 'GENERATED by `npm run demo:register`.', ''].join('\n')
    const problems = frontMatterProblems('docs/content/DEMO.md', generated)
    expect(problems[0]).toContain('no front matter')
    expect(problems.at(-1)).toContain('GENERATED by `npm run demo:register`')
    expect(problems.at(-1)).toContain('put the front matter in the generator')
  })

  /* A stub is a promise. Without a phase number it has no address, so it is an empty page. */
  it('fails a STUB with no owning phase, and passes one that names it', () => {
    const orphan = valid
      .replace('status: CURRENT', 'status: STUB')
      .replace('owning_phase: 46', 'owning_phase:')
    expect(frontMatterProblems('docs/example.md', orphan).join('\n')).toContain('no owning phase')
    const owned = valid.replace('status: CURRENT', 'status: STUB')
    expect(frontMatterProblems('docs/example.md', owned)).toEqual([])
  })
})

describe('the secret scanner', () => {
  const names = parseD8ServerOnly(readFileSync(join(ROOT, CONTRACT_PATH), 'utf8'))

  it('derives the never-expose names from D8 rather than a copied list', () => {
    expect(names).toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(names).toContain('CRON_SECRET')
    expect(names).toContain('CSP_ENFORCE')
    expect(names.length).toBeGreaterThanOrEqual(12)
  })

  /*
   * These are the lines the documentation is REQUIRED to be able to write. D8 names every variable,
   * `ENVIRONMENT.md` explains each one, `SECURITY.md` lists them as forbidden, and `.env.example`
   * carries each with an empty value. A gate that fails any of them is a gate that gets deleted.
   */
  it('passes a bare name, an empty value, a placeholder and a documented switch', () => {
    const innocent = [
      'Server-only: `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDINARY_API_SECRET`.',
      '| `CRON_SECRET` | Vercel project settings | The cron routes |',
      'CLOUDINARY_API_KEY=',
      'CLOUDINARY_API_SECRET=...',
      'export DATABASE_URL="postgresql://postgres:<password>@127.0.0.1:5433/rivya"',
      'Set `CSP_ENFORCE=1` in Vercel and redeploy.',
      'GOOGLE_SERVICE_ACCOUNT_JSON=your-service-account-json',
      'REVALIDATE_SECRET=xxxxxxxx',
      'The redactor strips `postgres://user:pass@` connection strings and `-----BEGIN … PRIVATE KEY-----` blocks.',
      'IP_HASH_SALT: REDACTED',
    ].join('\n')
    expect(scanSecrets(innocent, names)).toEqual([])
  })

  /*
   * SYNTHETIC VALUES, AND THEY ARE BUILT AT RUN TIME RATHER THAN TYPED.
   *
   * The assertions below need inputs shaped like a credential, and the first version of this test
   * simply wrote them out. `gitleaks` then failed the build on this file — correctly. A forty-character
   * literal at entropy 5.18 beside the words SUPABASE_SERVICE_ROLE_KEY is indistinguishable from a
   * real leak to anything that is not reading the surrounding comment, and a scanner that reasoned
   * "this one is in a test, so it is fine" would be a scanner that misses the day somebody pastes a
   * live key into a test.
   *
   * SO THE FIX IS NOT AN ALLOWLIST. `.gitleaks.toml` says what may be allowlisted — "only ever a
   * shape that CANNOT be a secret — a throwaway minted per test run, a documented placeholder. Never
   * a path, because 'ignore this file' is how the one real finding gets ignored with it." Adding this
   * file to an ignore list would blind the gate on every future edit to it, to save two lines.
   *
   * These two helpers make the values a throwaway minted per run instead. No literal in this file is
   * credential-shaped, `gitleaks` stays fully armed on it, and `scanSecrets` receives byte-for-byte
   * what it received before. The assertions still check the reported LENGTH and the rule NAME, never
   * a value, because the scanner deliberately never returns what it matched.
   */

  /** A base64-shaped run of `length` characters, generated so no such literal exists in the source. */
  function mintedToken(length: number): string {
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    return Array.from(
      { length },
      (_unused, index) => alphabet[(index * 17 + 5) % alphabet.length] ?? 'x',
    ).join('')
  }

  /*
   * The PEM armour, assembled so that `-----BEGIN` is never contiguous in this file's bytes.
   * `scanSecrets` matches /-----BEGIN [A-Z ]*PRIVATE KEY-----/ on the value it is given, which this
   * satisfies at run time; gitleaks matches the same shape on the SOURCE, which it no longer does.
   */
  const PEM_ARMOUR = `${'-----'}BEGIN RSA PRIVATE KEY-----`

  it('fails a value-shaped token, and reports its length and the rule, never the value', () => {
    const token = mintedToken(40)
    const hits = scanSecrets(`SUPABASE_SERVICE_ROLE_KEY=${token}`, names)
    expect(hits).toHaveLength(1)
    expect(hits[0]?.name).toBe('SUPABASE_SERVICE_ROLE_KEY')
    expect(hits[0]?.rule).toBe('20+ characters of base64/hex')
    expect(hits[0]?.length).toBe(token.length)
    expect(JSON.stringify(hits)).not.toContain(token)
  })

  it('fails a JWT, a connection string with a real password and a long digit run', () => {
    const jwt = scanSecrets('anon: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9synthetic', names)
    expect(jwt[0]?.rule).toBe('JWT (eyJ…)')
    const url = scanSecrets(
      'DATABASE_URL=postgresql://postgres:sYnth3t1cPassw0rd@db.example:5432/x',
      names,
    )
    expect(url[0]?.rule).toBe('connection URL carrying a password')
    const cloudinary = scanSecrets('CLOUDINARY_API_KEY=419573264180935', names)
    expect(cloudinary[0]?.rule).toBe('long digit run (API-key shaped)')
  })

  it('fails a PEM block but not a document describing one', () => {
    expect(scanSecrets(PEM_ARMOUR, names)[0]?.rule).toBe('PEM private-key block')
    expect(
      scanSecrets('blocks of the form `-----BEGIN … PRIVATE KEY-----` are stripped', names),
    ).toEqual([])
  })
})

describe('the claim classifier', () => {
  /*
   * The case the classifier exists for. Phase 46 verification step 9 says a plain grep is not
   * sufficient "because these documents legitimately use every one of those words while forbidding
   * them" — and `BUSINESS_RULES.md` has a whole table of them under one prohibiting heading.
   */
  it('counts a hit inside a prohibition as prohibited, on the table heading alone', () => {
    const prohibited = [
      '## Deliberately not built',
      '',
      '| Capability | Reason | Seam |',
      '|---|---|---|',
      '| Reviews and ratings | A testimonial is the owner’s to publish | `testimonials` |',
      '',
    ].join('\n')
    const hits = scanClaims(prohibited)
    expect(hits.map((hit) => hit.verdict)).toContain('PROHIBITED')
    expect(hits.every((hit) => hit.verdict !== 'ASSERTION')).toBe(true)
  })

  it('counts a bare business claim as an assertion, and names the term and the line', () => {
    const asserted = [
      '# About',
      '',
      'Rivya is ISO 9001 certified and has delivered 40 projects for clients across India.',
      '',
    ].join('\n')
    const assertions = scanClaims(asserted).filter((hit) => hit.verdict === 'ASSERTION')
    expect(assertions.map((hit) => hit.term).sort()).toEqual(['certified', 'client'])
    expect(assertions[0]?.line).toBe(3)
    expect(assertions[0]?.text).toContain('ISO 9001')
  })

  /*
   * The words that are also the schema's. `client` is a React Client Component and a Supabase
   * client far more often than it is a customer, and `testimonials` is a table — a gate that could
   * not tell those apart would report two hundred findings and be switched off within a week.
   */
  it('reads a technical use of a shared word as the system rather than a claim', () => {
    const technical = [
      '# Rendering',
      '',
      '| `MediaVideo` | Phase 06 | Client | Poster first, muted inline loop |',
      '',
    ].join('\n')
    expect(scanClaims(technical).every((hit) => hit.verdict !== 'ASSERTION')).toBe(true)
  })

  it('ignores the vocabulary inside a fenced block, a code span and an identifier', () => {
    const notProse = [
      '# Prompts',
      '',
      '```',
      'Exclude entirely: award or certification badges, stock-photo smile.',
      '```',
      '',
      'The column is `client_consent` and the surface is /studio/content/testimonials.',
      '',
    ].join('\n')
    expect(scanClaims(notProse).filter((hit) => hit.verdict === 'ASSERTION')).toEqual([])
  })

  it('scans the fixed Phase 46 vocabulary and nothing it invented', () => {
    expect(CLAIM_TERMS).toEqual([
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
    ])
  })
})

describe('the roadmap reading', () => {
  /*
   * Phase 46 adds the Status column to the 47-phase table while this gate is being written, so the
   * parser finds the column by NAME and reports a SKIP with its reason when there is none. Failing
   * would block on a document nobody had finished; inventing a status would be worse than both.
   */
  it('finds the status column by name and skips, with a reason, when there is none', () => {
    const withStatus = [
      '| # | Phase | Status | Depends on |',
      '|---|---|---|---|',
      '| **00** | Baseline | **COMPLETE** | None |',
      '| **46** | Handoff | **PLANNED** | Phase 01 |',
    ].join('\n')
    const parsed = parseRoadmapStatuses(withStatus)
    expect(parsed.supported).toBe(true)
    expect(parsed.statuses.get('0')).toContain('COMPLETE')
    expect(parsed.statuses.get('46')).toContain('PLANNED')

    const withoutStatus = [
      '| # | Phase | Depends on |',
      '|---|---|---|',
      '| **00** | Baseline | None |',
    ].join('\n')
    const skipped = parseRoadmapStatuses(withoutStatus)
    expect(skipped.supported).toBe(false)
    expect(skipped.reason).toContain('no "Status" column')
  })

  it('reads the roadmap’s own vocabulary rather than demanding one word', () => {
    expect(isPhaseComplete('**COMPLETE**')).toBe(true)
    expect(isPhaseComplete('**CODE COMPLETE; CATALOGUE EMPTY BY DESIGN**')).toBe(true)
    expect(isPhaseComplete('**DEVELOPMENT COMPLETE** — tests deferred to Phase 42')).toBe(true)
    expect(isPhaseComplete('**PARTIAL** — three questions are the owner’s')).toBe(false)
    expect(isPhaseComplete('**PLANNED**')).toBe(false)
    expect(isPhaseComplete('**IN PROGRESS**')).toBe(false)
  })
})
