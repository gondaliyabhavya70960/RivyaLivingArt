import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  canPublish,
  projectPublishGates,
  testimonialPublishGates,
  type ProjectGateInput,
  type TestimonialGateInput,
} from '@/lib/portfolio/gates'

import { FIXTURE_USERS, asAnon, asSession, disconnect, loadFixture } from './harness'

/**
 * Phase 17 at the table: the two evidence gates, the concept-media refusal, and the column anon may
 * not read.
 *
 * THE CENTRAL TEST IS AN AGREEMENT TEST. `lib/portfolio/gates.ts` computes what stands between a row
 * and publication so the Studio can say it in words BEFORE anyone presses Publish; the triggers
 * enforce the same rules in plpgsql. Those are two implementations of one policy, written in two
 * languages, with nothing in the type system tying them together — exactly the shape that drifts.
 * So for every combination below, this asks the pure function whether publishing should be allowed,
 * then asks the DATABASE to publish the same row, and requires the two answers to match. A panel
 * that promises a publish the trigger refuses is worse than no panel.
 */

const REQUIRE_DB = process.env.CI === 'true' || process.env.RLS_TESTS_REQUIRED === '1'
const HAVE_DB = Boolean(process.env.DATABASE_URL)

if (REQUIRE_DB && !HAVE_DB) {
  throw new Error(
    'DATABASE_URL is not set and this environment requires the database suite to run. ' +
      'Refusing to skip: a skipped guard suite reports success while proving nothing.',
  )
}

const describeDb = HAVE_DB ? describe : describe.skip

const asOwner = <T>(fn: Parameters<typeof asSession<T>>[2]) =>
  asSession('authenticated', FIXTURE_USERS.owner, fn)

/**
 * Every combination of the three columns the project gate reads, MINUS the one the schema forbids.
 *
 * A NAMED CLIENT WITH `NOT_APPLICABLE` CONSENT CANNOT BE STORED AT ALL —
 * `portfolio_projects_consent_coherent` refuses the insert, because "consent does not apply" beside
 * a client's name is a contradiction rather than a draft. The first run of this suite included that
 * pair and failed on it: the insert threw, which is neither "published" nor "refused publication".
 * It is excluded here and asserted directly below, so both facts are tested and neither is implied
 * by the other.
 */
const IMPOSSIBLE = (input: ProjectGateInput) =>
  input.client_display_name !== null && input.client_consent === 'NOT_APPLICABLE'

const PROJECT_CASES: readonly ProjectGateInput[] = ['NOT_REQUIRED', 'VERIFIED']
  .flatMap((verify) =>
    [null, 'A Client'].flatMap((name) =>
      ['NOT_APPLICABLE', 'PENDING', 'GRANTED', 'WITHDRAWN'].map((consent) => ({
        owner_verification: verify,
        client_display_name: name,
        client_consent: consent,
      })),
    ),
  )
  .filter((input) => !IMPOSSIBLE(input))

const TESTIMONIAL_CASES: readonly TestimonialGateInput[] = ['NOT_REQUIRED', 'VERIFIED'].flatMap(
  (verify) =>
    [null, 'Someone'].flatMap((name) =>
      ['PENDING', 'GRANTED', 'WITHDRAWN'].map((consent) => ({
        owner_verification: verify,
        attributed_to: name,
        consent,
      })),
    ),
)

describeDb('the project evidence gate agrees with lib/portfolio/gates', () => {
  beforeAll(loadFixture)
  afterAll(disconnect)

  it.each(PROJECT_CASES)(
    'verification=$owner_verification name=$client_display_name consent=$client_consent',
    async (input) => {
      const predicted = canPublish(projectPublishGates(input))

      const actual = await asOwner(async (sql) => {
        await sql.rows(
          `insert into portfolio_projects
             (slug, title, owner_verification, is_client_project, client_display_name, client_consent)
           values ('agree-probe','Probe',$1::owner_verification,$2,$3,$4::client_consent_state)`,
          [
            input.owner_verification,
            input.client_display_name !== null,
            input.client_display_name,
            input.client_consent,
          ],
        )
        const attempt = await sql.attempt(
          "update portfolio_projects set status = 'PUBLISHED' where slug = 'agree-probe'",
        )
        if (!attempt.ok) return false

        // NOT AN ERROR IS NOT THE SAME AS PUBLISHED. A withdrawn consent is archived in place by
        // the trigger rather than refused, so the statement succeeds and the row is NOT public.
        // Reading the status back is what tells those two apart.
        const rows = await sql.rows<{ status: string }>(
          "select status from portfolio_projects where slug = 'agree-probe'",
        )
        return rows[0]?.status === 'PUBLISHED'
      })

      expect(actual, JSON.stringify(input)).toBe(predicted)
    },
  )
})

describeDb('a client name and NOT_APPLICABLE consent is not a storable state', () => {
  beforeAll(loadFixture)
  afterAll(disconnect)

  it('refuses the row outright rather than letting it sit as an unpublishable draft', async () => {
    const result = await asOwner((sql) =>
      sql.attempt(
        `insert into portfolio_projects
           (slug, title, is_client_project, client_display_name, client_consent)
         values ('incoherent','Probe',true,'A Client','NOT_APPLICABLE')`,
      ),
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('portfolio_projects_consent_coherent')
  })
})

describeDb('the testimonial evidence gate agrees with lib/portfolio/gates', () => {
  beforeAll(loadFixture)
  afterAll(disconnect)

  it.each(TESTIMONIAL_CASES)(
    'verification=$owner_verification name=$attributed_to consent=$consent',
    async (input) => {
      const predicted = canPublish(testimonialPublishGates(input))

      const actual = await asOwner(async (sql) => {
        const inserted = await sql.rows<{ id: string }>(
          `insert into testimonials (quote, attributed_to, owner_verification, consent)
           values ('A quote', $1, $2::owner_verification, $3::client_consent_state)
           returning id`,
          [input.attributed_to, input.owner_verification, input.consent],
        )
        const id = inserted[0]?.id
        const attempt = await sql.attempt('update testimonials set status = $2 where id = $1', [
          id,
          'PUBLISHED',
        ])
        if (!attempt.ok) return false

        const rows = await sql.rows<{ status: string }>(
          'select status from testimonials where id = $1',
          [id],
        )
        return rows[0]?.status === 'PUBLISHED'
      })

      expect(actual, JSON.stringify(input)).toBe(predicted)
    },
  )
})

describeDb('withdrawal takes a published row off the site on the same statement', () => {
  beforeAll(loadFixture)
  afterAll(disconnect)

  /**
   * THE PATH THE PHASE DOCUMENT'S OWN PSEUDO-CODE GOT WRONG. Written with the WITHDRAWN branch last,
   * the gate refuses this update — `new.status` is still PUBLISHED, so the consent check raises and
   * the withdrawal never lands, leaving the project live under the name of someone who has just
   * asked not to be named. This asserts the corrected order.
   */
  it('archives a published, consented project when consent is withdrawn', async () => {
    const status = await asOwner(async (sql) => {
      await sql.rows(
        `insert into portfolio_projects
           (slug, title, owner_verification, is_client_project, client_display_name, client_consent)
         values ('withdraw-probe','Probe','VERIFIED',true,'A Client','GRANTED')`,
      )
      await sql.rows("update portfolio_projects set status='PUBLISHED' where slug='withdraw-probe'")

      const attempt = await sql.attempt(
        "update portfolio_projects set client_consent='WITHDRAWN' where slug='withdraw-probe'",
      )
      expect(attempt.ok, attempt.error).toBe(true)

      const rows = await sql.rows<{ status: string }>(
        "select status from portfolio_projects where slug='withdraw-probe'",
      )
      return rows[0]?.status
    })

    expect(status).toBe('ARCHIVED')
  })
})

describeDb('concept media may never illustrate delivered work', () => {
  beforeAll(loadFixture)
  afterAll(disconnect)

  it('refuses a concept render on a project gallery', async () => {
    const result = await asOwner(async (sql) => {
      const inserted = await sql.rows<{ id: string }>(
        "insert into portfolio_projects (slug, title) values ('concept-probe','Probe') returning id",
      )
      return sql.attempt(
        `insert into portfolio_project_media (project_id, media_asset_id, role)
         select $1, m.id, 'gallery' from media_assets m where m.is_concept limit 1`,
        [inserted[0]?.id],
      )
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('concept media cannot be attached to a portfolio project')
  })
})

describeDb('the evidence note is not public', () => {
  beforeAll(loadFixture)
  afterAll(disconnect)

  /**
   * RLS FILTERS ROWS, NOT COLUMNS. A shape-A policy alone publishes every column of a published
   * project — including the note recording an invoice reference or where the photographs live.
   * `0152` drops anon's table-level SELECT and grants back a named list without it. This asserts the
   * refusal directly, because a repository that merely declines to select the column protects
   * nothing: PostgREST builds its column list from the request.
   */
  it('refuses anon the evidence_note column', async () => {
    const result = await asAnon((sql) =>
      sql.attempt('select evidence_note from portfolio_projects'),
    )
    expect(result.ok).toBe(false)
    expect(result.error).toContain('permission denied')
  })

  it('still lets anon read the columns a visitor needs', async () => {
    const result = await asAnon((sql) => sql.attempt('select slug, title from portfolio_projects'))
    expect(result.ok).toBe(true)
  })

  /** Staff need it — it is the field the Verification panel shows the owner before they publish. */
  it('lets staff read it', async () => {
    const result = await asOwner((sql) =>
      sql.attempt('select evidence_note from portfolio_projects'),
    )
    expect(result.ok).toBe(true)
  })
})
