import { afterAll, describe, expect, it } from 'vitest'

import { FIXTURE_MEDIA, FIXTURE_STAFF, fixtureId } from '../fixtures/ids'
import { connect, disconnect } from '../unit/rls/harness'

/**
 * THE GATES THAT STOP A CLAIM REACHING THE PUBLIC SITE — Phase 42.
 *
 * `CLAUDE.md` forbids fabricated business facts: prices, delivered projects, named customers,
 * testimonials. Those rules are enforced in three places — a form, a server action, and the
 * database — and only the last one cannot be bypassed. A bulk import, a `psql` session, a restore
 * from a backup and a future Server Action written by someone who has not read the rules all reach
 * the table directly.
 *
 * So this suite attempts, one by one, the exact writes the business rules forbid, AS THE OWNER OF
 * THE DATABASE — the most privileged connection there is, the one that bypasses every policy. What
 * remains after RLS is stripped away is what these gates are worth.
 *
 * EVERY ATTEMPT IS ROLLED BACK. Nothing here commits; a gate that failed to refuse would otherwise
 * leave the forbidden row behind for the next suite to trip over.
 */

const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)
if (REQUIRE_DB && !HAVE_DB) {
  throw new Error('DATABASE_URL is not set and this environment requires the database suite to run.')
}
const describeDb = HAVE_DB ? describe : describe.skip

/** Run one statement inside a transaction that is always rolled back; report what happened. */
async function attempt(
  text: string,
  values: unknown[] = [],
): Promise<{ refused: boolean; message: string }> {
  const db = await connect()
  await db.query('begin')
  try {
    await db.query(text, values)
    await db.query('rollback')
    return { refused: false, message: '' }
  } catch (error) {
    await db.query('rollback')
    return { refused: true, message: error instanceof Error ? error.message : String(error) }
  }
}

/** An id in the fixture's range but outside every group the seeder uses, so it collides with nothing. */
const probe = (n: number): string => fixtureId('media', 800 + n)

describeDb('the database refuses a fabricated business fact', () => {
  afterAll(async () => {
    await disconnect()
  })

  it('refuses a published product with a price and no owner verification', async () => {
    /*
     * A PRICE IS A BUSINESS FACT. `products_verified_before_publish` is what stops a bulk import
     * from putting a figure on the public site that nobody at the studio has agreed to.
     */
    const result = await attempt(
      `insert into products (id, slug, title, price_state, price_minor, currency, status,
                             owner_verification, fact_classification)
       values ($1,'probe-priced','Probe','FIXED',1000,'INR','PUBLISHED',
               'OWNER_VERIFICATION_REQUIRED','PRODUCT_FACT')`,
      [probe(1)],
    )
    expect(result.refused).toBe(true)
    expect(result.message).toMatch(/verified_before_publish/)
  })

  it('refuses a FIXED product with no price at all', async () => {
    // The other direction: a price STATE that promises a number, with no number behind it.
    const result = await attempt(
      `insert into products (id, slug, title, price_state, status, owner_verification,
                             fact_classification)
       values ($1,'probe-no-price','Probe','FIXED','DRAFT','NOT_REQUIRED','PRODUCT_FACT')`,
      [probe(2)],
    )
    expect(result.refused).toBe(true)
    expect(result.message).toMatch(/price_state_coherent/)
  })

  it('refuses a published portfolio project the owner has not verified', async () => {
    /*
     * A PORTFOLIO PROJECT ASSERTS THAT RIVYA DELIVERED THIS. It is the claim most likely to be
     * invented by a seeder trying to make a page look populated, which is exactly why the fixture's
     * own project stays DRAFT.
     */
    const result = await attempt(
      `insert into portfolio_projects (id, slug, title, status, owner_verification,
                                       fact_classification, client_consent, is_client_project)
       values ($1,'probe-project','Probe','PUBLISHED','OWNER_VERIFICATION_REQUIRED',
               'EDITORIAL_COPY','NOT_APPLICABLE',false)`,
      [probe(3)],
    )
    expect(result.refused).toBe(true)
  })

  it('refuses a published project that names a client without their consent', async () => {
    const result = await attempt(
      `insert into portfolio_projects (id, slug, title, status, owner_verification,
                                       fact_classification, client_display_name, client_consent,
                                       is_client_project)
       values ($1,'probe-client','Probe','PUBLISHED','VERIFIED','EDITORIAL_COPY',
               'A Named Person','PENDING',true)`,
      [probe(4)],
    )
    expect(result.refused).toBe(true)
    expect(result.message).toMatch(/consent/i)
  })

  it('archives a published project the moment consent is withdrawn', async () => {
    /*
     * THE ONE GATE THAT MUST NOT REFUSE. Withdrawal has to take effect on the statement that
     * records it — a rule that blocked the withdrawal would leave the project published under the
     * name of someone who has just asked not to be named.
     */
    const db = await connect()
    await db.query('begin')
    try {
      await db.query(
        `insert into portfolio_projects (id, slug, title, status, owner_verification,
                                         fact_classification, client_display_name, client_consent,
                                         client_consent_reference, is_client_project)
         values ($1,'probe-withdraw','Probe','PUBLISHED','VERIFIED','EDITORIAL_COPY',
                 'A Named Person','GRANTED','signed-2026-01',true)`,
        [probe(5)],
      )
      await db.query(`update portfolio_projects set client_consent = 'WITHDRAWN' where id = $1`, [
        probe(5),
      ])
      const rows = await db.query<{ status: string }>(
        'select status from portfolio_projects where id = $1',
        [probe(5)],
      )
      expect(rows.rows[0]?.status).toBe('ARCHIVED')
    } finally {
      await db.query('rollback')
    }
  })

  it('refuses a published collection that is still a concept', async () => {
    // FEAT §9: a collection is a proposal until the owner says it is real. "Published but
    // unconfirmed" is a state the business does not have.
    const result = await attempt(
      `insert into collections (id, slug, name, status, concept_state, owner_verification,
                                fact_classification)
       values ($1,'probe-collection','Probe','PUBLISHED','DRAFT_COLLECTION_CONCEPT','VERIFIED',
               'BRAND_COPY')`,
      [probe(6)],
    )
    expect(result.refused).toBe(true)
  })

  it('refuses a published article with no body', async () => {
    // SEED §20 seeds ideas, not articles. An article page with nothing on it is an idea.
    const result = await attempt(
      `insert into journal_articles (id, slug, title, byline, status, owner_verification,
                                     fact_classification)
       values ($1,'probe-article','Probe','Rivya Studio','PUBLISHED','NOT_REQUIRED','EDITORIAL_COPY')`,
      [probe(7)],
    )
    expect(result.refused).toBe(true)
    expect(result.message).toMatch(/body/i)
  })

  it('refuses a concept render as a product hero', async () => {
    /*
     * D6 AND D10. A concept render may illustrate a material or a process; it may never stand in
     * for a product, because a product card is a picture of a thing somebody can buy.
     */
    const db = await connect()
    await db.query('begin')
    try {
      await db.query(
        `insert into media_assets (id, provider, resource_type, public_id, folder, kind, alt_text,
                                   is_ai_generated, is_concept, status, owner_verification, source)
         values ($1,'cloudinary','image','probe/concept','probe','IMAGE','probe concept',
                 true,true,'PUBLISHED','NOT_REQUIRED','RENDER')`,
        [probe(8)],
      )
      await db.query(
        `insert into products (id, slug, title, price_state, hero_media_id, status,
                               owner_verification, fact_classification)
         values ($1,'probe-concept-hero','Probe','REQUEST_QUOTE',$2,'DRAFT','NOT_REQUIRED',
                 'PRODUCT_FACT')`,
        [probe(9), probe(8)],
      )
      throw new Error('the concept hero was accepted')
    } catch (error) {
      expect(error instanceof Error ? error.message : String(error)).not.toBe(
        'the concept hero was accepted',
      )
    } finally {
      await db.query('rollback')
    }
  })

  it('refuses a testimonial with no evidence', async () => {
    // A named customer saying something they did not say is the single worst thing this site could
    // publish, and the gate is the only thing standing between a seeder and it.
    const result = await attempt(
      `insert into testimonials (id, quote, attribution_name, status, owner_verification,
                                 fact_classification)
       values ($1,'Probe quote','A Named Person','PUBLISHED','OWNER_VERIFICATION_REQUIRED',
               'EDITORIAL_COPY')`,
      [probe(10)],
    )
    expect(result.refused).toBe(true)
  })

  it('refuses a media asset with neither alt text nor a decorative mark', async () => {
    // WCAG 1.1.1, expressed where it cannot be skipped. Phase 41's `0390`.
    const result = await attempt(
      `insert into media_assets (id, provider, resource_type, public_id, folder, kind, alt_text,
                                 is_ai_generated, is_concept, is_decorative, status,
                                 owner_verification, source)
       values ($1,'cloudinary','image','probe/no-alt','probe','IMAGE','',true,false,false,
               'DRAFT','NOT_REQUIRED','RENDER')`,
      [probe(11)],
    )
    expect(result.refused).toBe(true)
  })

  it('accepts the fixture rows it is modelled on', async () => {
    /*
     * LOAD-BEARING. Every assertion above passes if the database simply refuses all inserts — a
     * misconfigured connection, a missing search path, a transaction left aborted. This one proves
     * the same connection can still write a legitimate row, so the refusals above mean something.
     */
    const result = await attempt(
      `insert into products (id, slug, title, price_state, hero_media_id, status,
                             owner_verification, fact_classification, updated_by)
       values ($1,'probe-legitimate','Probe','REQUEST_QUOTE',$2,'DRAFT','NOT_REQUIRED',
               'PRODUCT_FACT',$3)`,
      [probe(12), FIXTURE_MEDIA[0]?.id ?? null, FIXTURE_STAFF.owner],
    )
    expect(result.refused, result.message).toBe(false)
  })
})
