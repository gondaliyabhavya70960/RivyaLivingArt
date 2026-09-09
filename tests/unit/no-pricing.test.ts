import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { fieldValidationSchema } from '../../lib/cms/forms'
import { formFieldTypeSchema } from '../../lib/supabase/schemas'

/**
 * BR-F4b, made mechanical: nothing in the customization system may price anything.
 *
 * FEAT §15 says it in as many words — do not calculate fake bespoke pricing — and D1 forbids
 * checkout outright. The risk this guards is NOT that somebody puts a price on the public form;
 * nobody would. It is that somebody adds `price_modifier` to a field "just for internal
 * estimating", and six months later a summary renders it. By then the column exists, three
 * migrations depend on it, and removing it is a project.
 *
 * SO THE TEST READS THE SOURCE, not the behaviour. A behavioural test would assert that today's
 * review screen shows no total, which is true and stays true right up until the moment somebody
 * adds one. Grepping the migration and the configurator directory fails on the COLUMN, on the day
 * it is written.
 */

/**
 * Price-shaped identifiers. Deliberately broad: a false positive is a conversation, a miss is a
 * defect.
 *
 * NO `\\b` ON THE RIGHT, AND THAT IS THE SECOND BUG THE MUTATION CHECK FOUND. `\\bprice\\b` does not
 * match `price_modifier` or `priceEstimate`, because `_` and `E` are word characters and there is
 * no boundary after `price` — so the very identifiers this guard exists to catch were the ones it
 * could not see. A lookbehind on the left keeps `unit_cost` and `resinCost` matching while a bare
 * prefix match catches the rest.
 */
const FORBIDDEN =
  /(?<![A-Za-z])(price|pricing|cost|surcharge|multiplier|estimate|quote|subtotal|currency|discount|markup|margin)/i

/**
 * Where the words are allowed to appear anyway.
 *
 * A COMMENT EXPLAINING THE PROHIBITION HAS TO BE ABLE TO NAME IT. Migration 0170's header says
 * "no price column exists" and the validation CHECK lists `price_multiplier` as an example of what
 * it rejects; a test that failed on those would force the reasoning out of the file that needs it
 * most. So comments and string literals are stripped before searching, exactly as
 * `db:check-data-layer` does for `.from(`.
 */
function stripCommentsAndStrings(source: string, sql: boolean): string {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(sql ? /--[^\n]*/g : /\/\/[^\n]*/g, ' ')

  /*
   * SQL AND TYPESCRIPT ESCAPE QUOTES DIFFERENTLY, AND THE FIRST VERSION OF THIS FILE GOT IT WRONG
   * IN A WAY THAT MADE THE WHOLE GUARD USELESS.
   *
   * It used the JavaScript pattern — `'(?:[^'\\]|\\.)*'` — on the migration too. SQL does not
   * escape a quote with a backslash; it DOUBLES it, as in `'a form''s steps'`. Every doubled quote
   * therefore ended one match and started another half a string out of phase, and from the first
   * one onward the pairing was inverted: real code was treated as string content and swallowed.
   * Adding `price_modifier numeric` to migration 0170 and re-running the test PASSED, which is how
   * this was found — the mutation check is the only reason this file is not decoration.
   */
  return sql
    ? withoutComments.replace(/'(?:[^']|'')*'/g, "''")
    : withoutComments
        .replace(/'(?:[^'\\]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/`(?:[^`\\]|\\.)*`/g, '``')
}

function filesUnder(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) found.push(...filesUnder(full))
    else found.push(full)
  }
  return found
}

const WATCHED = [
  'supabase/migrations/0170_phase19_customization_forms.sql',
  'lib/cms/forms.ts',
  'components/sections/CommissionConfiguratorSection.tsx',
  'content/blocks/commission-configurator.ts',
  'content/seed/configurator-ui.ts',
  ...filesUnder('components/patterns/Configurator'),
]

describe('no pricing in the customization system', () => {
  it('watches the files the rule names, and finds them', () => {
    // A guard whose target has been renamed passes silently. This is the assertion that stops it.
    expect(WATCHED.length).toBeGreaterThanOrEqual(9)
    for (const file of WATCHED) {
      expect(() => readFileSync(file, 'utf8'), file).not.toThrow()
    }
  })

  for (const file of WATCHED) {
    it(`has no price-shaped identifier in ${file}`, () => {
      const code = stripCommentsAndStrings(readFileSync(file, 'utf8'), file.endsWith('.sql'))
      const match = code.match(FORBIDDEN)
      expect(
        match,
        match === null
          ? ''
          : `"${match[0]}" appears in ${file}. FEAT §15 and BR-F4b forbid it: nothing in the ` +
              'configurator may hold, derive or display a price. If this is genuinely not about ' +
              'money, rename it — the guard is deliberately broad.',
      ).toBeNull()
    })
  }

  /**
   * The `validation` allowlist is the door a surcharge would come through, so it is asserted as a
   * closed set rather than merely "contains min and max". The database enforces the same list as a
   * CHECK; this is the half that fails in the editor.
   */
  it('accepts only the nine Zod validation keys', () => {
    expect(Object.keys(fieldValidationSchema.shape).sort()).toEqual([
      'accept',
      'max',
      'maxBytes',
      'maxFiles',
      'maxLength',
      'min',
      'minLength',
      'pattern',
      'step',
    ])
  })

  it('refuses a validation object carrying a price key', () => {
    expect(fieldValidationSchema.safeParse({ price_multiplier: 2 }).success).toBe(false)
    expect(fieldValidationSchema.safeParse({ surcharge: 100 }).success).toBe(false)
    expect(fieldValidationSchema.safeParse({ min: 1, max: 10 }).success).toBe(true)
  })

  /** Fourteen field types, and not one of them is a currency input. */
  it('has no money-shaped field type', () => {
    for (const type of formFieldTypeSchema.options) {
      expect(type, `${type} is a field type`).not.toMatch(FORBIDDEN)
    }
  })
})
