import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { stripCommentsAndStrings } from '@/scripts/db/strip-code.mjs'
import * as rules from '@/lib/relations/rules'
import { RULE_KEYS, RULE_REASON_KEY, RULE_RELATION_TYPE } from '@/lib/relations/rules'
import { RELATION_TARGETS, RELATION_VOCABULARY } from '@/lib/supabase/schemas'
import { searchUiSeed } from '@/content/seed/search-ui'

/**
 * The rules propose. They do not write, and there are exactly four of them.
 *
 * THE MOST IMPORTANT TEST IN THIS FILE ASSERTS AN ABSENCE. FEAT §11 permits an automatic relation
 * only where a reliable rule exists, and the design that keeps that honest is that no rule can
 * persist anything: an edge exists because somebody pressed Accept, which is what `origin` records.
 * A rule that started writing would make `origin` a lie — a row nobody accepted, with no answer to
 * "where did this come from" — and nothing in the type system would notice, because a write is just
 * another method on the same client. So the module's own source is read and asserted against.
 *
 * THE VOCABULARY IS ASSERTED AGAINST THE SQL, not against a second copy of the list. `0213` carries
 * the same nine names inside `is_relation_type()`; two lists that must agree and are checked by
 * nobody are two lists that will diverge.
 */

/**
 * COMMENTS AND STRING LITERALS ARE STRIPPED FIRST, and the first run of this suite is why: the
 * module's own header describes the rule being asserted — "its source contains no `.insert(`" —
 * and the test failed on the sentence explaining what it was testing. The same helper every
 * repository guard uses, so a comment can go on saying what the code may not do.
 */
const SOURCE = stripCommentsAndStrings(readFileSync('lib/relations/rules.ts', 'utf8'), {
  // String literals are KEPT: the table names this module is allowed to read are string literals,
  // and blanking them would erase the thing the last assertion below is looking for.
  strings: false,
})
const MIGRATION = readFileSync('supabase/migrations/0213_phase23_relations.sql', 'utf8')

describe('there are exactly four rules', () => {
  it('and the phase document names all four', () => {
    expect([...RULE_KEYS]).toEqual([
      'same-collection',
      'shared-materials',
      'journal-linked-product',
      'project-featured-product',
    ])
  })

  it('each proposes a relation type from the fixed vocabulary', () => {
    for (const key of RULE_KEYS) {
      expect(RELATION_VOCABULARY).toContain(RULE_RELATION_TYPE[key])
    }
  })

  it('each has a seeded reason, so an editor can judge it rather than trust it', () => {
    const seeded = new Set(searchUiSeed.records.map((record) => String(record.fields['key'] ?? '')))
    for (const key of RULE_KEYS) {
      expect(seeded, key).toContain(RULE_REASON_KEY[key])
    }
  })
})

describe('no rule writes', () => {
  it('exports no function whose name suggests a mutation', () => {
    const mutating = Object.keys(rules).filter((name) =>
      /^(create|insert|update|delete|remove|save|accept|dismiss|write|persist)/i.test(name),
    )
    expect(mutating).toEqual([])
  })

  it('contains no insert, update, upsert or delete call anywhere in its source', () => {
    for (const method of ['.insert(', '.update(', '.upsert(', '.delete(', '.rpc(']) {
      expect(SOURCE, method).not.toContain(method)
    }
  })

  it('reads relation_suppressions, because a dismissed suggestion must never return', () => {
    expect(SOURCE).toContain("from('relation_suppressions')")
  })
})

describe('the vocabulary in TypeScript matches the vocabulary in SQL', () => {
  it('nine relation names, the same nine', () => {
    const sql = /is_relation_type\(value text\)[\s\S]*?select value in \(([\s\S]*?)\);/.exec(
      MIGRATION,
    )?.[1]
    const listed = [...(sql ?? '').matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]).sort()
    expect(listed).toEqual([...RELATION_VOCABULARY].sort())
  })

  it('six target types, the same six', () => {
    const sql = /is_relation_target\(value text\)[\s\S]*?select value in \(([\s\S]*?)\);/.exec(
      MIGRATION,
    )?.[1]
    const listed = [...(sql ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()
    expect(listed).toEqual([...RELATION_TARGETS].sort())
  })

  it('ties origin to rule_key in both directions, so neither can exist without the other', () => {
    expect(MIGRATION).toMatch(
      /product_relations_rule_key_matches_origin\s+check \(\(origin = 'RULE_ACCEPTED'\) = \(rule_key is not null\)\)/,
    )
    expect(MIGRATION).toMatch(
      /content_relations_rule_key_matches_origin\s+check \(\(origin = 'RULE_ACCEPTED'\) = \(rule_key is not null\)\)/,
    )
  })
})

describe('product_attribute_terms ships empty and cannot be published unverified', () => {
  it('has no seed module writing it', () => {
    expect(MIGRATION).not.toContain('insert into product_attribute_terms')
  })

  it('defaults to OWNER_VERIFICATION_REQUIRED, which is the opposite of most tables', () => {
    expect(MIGRATION).toMatch(
      /owner_verification\s+owner_verification not null default 'OWNER_VERIFICATION_REQUIRED'/,
    )
  })

  it('carries the D10 gate', () => {
    expect(MIGRATION).toContain('product_attribute_terms_verified_before_publish')
  })
})
