import { describe, expect, it } from 'vitest'

import { PERSONAL_FIELDS, RETENTION_MONTHS } from '@/lib/inquiries/pii'
import { FORBIDDEN_PAYLOAD_KEYS } from '@/lib/supabase/schemas/vitals'
import { REDACTED, redact } from '@/lib/logging/redact'

/**
 * WHERE PERSONAL DATA IS AND IS NOT — Phase 41, tested in Phase 42.
 *
 * `inquiries` is the only personal data in this product. That claim is load-bearing — the privacy
 * policy rests on it, the retention procedure rests on it, and SECURITY §1 states it as a fact —
 * and it is exactly the kind of claim that rots: somebody adds a `city` to an analytics table for a
 * good reason and the sentence quietly stops being true.
 *
 * SO THE TEST READS THE LIST RATHER THAN REPEATING IT. `PERSONAL_FIELDS` is the definition of what
 * counts as personal; every assertion below derives from it, so adding a column there is what
 * arms the checks rather than something a person has to remember to mirror here.
 */

describe('the personal-field list', () => {
  it('names every column an erasure clears', () => {
    // If this set shrinks, an erasure stops clearing something. If it grows, the schema gained a
    // personal column — which is a decision, and this test is where it gets noticed.
    expect(Object.keys(PERSONAL_FIELDS).sort()).toEqual([
      'answers',
      'city',
      'email',
      'ip_hash',
      'message',
      'name',
      'phone',
    ])
  })

  it('replaces the two NOT NULL columns with a marker rather than nulling them', () => {
    /*
     * `name` and `phone` are `not null` in the schema, so they cannot be nulled — and dropping the
     * constraint to allow erasure would remove the guarantee that a LIVE enquiry is contactable.
     * The marker is not a name and is not mistakable for one.
     */
    expect(PERSONAL_FIELDS.name.erasedTo).toBe('[erased]')
    expect(PERSONAL_FIELDS.phone.erasedTo).toBe('[erased]')
    expect(PERSONAL_FIELDS.name.nullable).toBe(false)
    expect(PERSONAL_FIELDS.phone.nullable).toBe(false)
  })

  it('nulls everything that can be nulled', () => {
    for (const [field, rule] of Object.entries(PERSONAL_FIELDS)) {
      if (rule.nullable) {
        expect(rule.erasedTo, `${field} is nullable and should erase to null`).toBeNull()
      }
    }
  })

  it('keeps the retention window at the 24-month minimum FEAT §47 states', () => {
    expect(RETENTION_MONTHS).toBe(24)
  })
})

describe('personal data stays out of the tables that are not for it', () => {
  it('is refused by name in a vitals beacon', () => {
    /*
     * `web_vitals_samples` has no column an identifier could go in — that is Phase 40's design —
     * and the payload schema refuses the names anyway, so a well-meaning addition to the reporter
     * fails at the boundary rather than at a constraint nobody reads.
     */
    for (const field of Object.keys(PERSONAL_FIELDS)) {
      expect(FORBIDDEN_PAYLOAD_KEYS, `a vitals payload must refuse ${field}`).toContain(field)
    }
  })

  it('is redacted out of a log line', () => {
    /*
     * THROUGH `redact()` RATHER THAN AGAINST THE KEY LIST, because the list is private and the
     * BEHAVIOUR is what matters: a log call that passed a whole inquiry row must write
     * `[redacted]` rather than a person's name, whatever mechanism gets it there.
     */
    const row = Object.fromEntries(
      Object.keys(PERSONAL_FIELDS).map((field) => [field, `real-${field}-value`]),
    )
    const redacted = redact(row) as Record<string, unknown>

    for (const field of Object.keys(PERSONAL_FIELDS)) {
      expect(redacted[field], `${field} must be redacted from logs`).toBe(REDACTED)
    }
  })
})
