#!/usr/bin/env tsx
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import pg from 'pg'

import {
  FIXTURE_ARTICLES,
  FIXTURE_ARTICLE_SLUG,
  FIXTURE_COLLECTION,
  FIXTURE_COLLECTION_SLUG,
  FIXTURE_EMAIL,
  FIXTURE_FAQS,
  FIXTURE_ID_PREFIX,
  FIXTURE_INQUIRIES,
  FIXTURE_INQUIRY_REFERENCE,
  FIXTURE_MEDIA,
  FIXTURE_NOW,
  FIXTURE_PRODUCTS,
  FIXTURE_PRODUCT_SLUG,
  FIXTURE_PROJECT,
  FIXTURE_PROJECT_SLUG,
  FIXTURE_RESEARCH_PRODUCTS,
  FIXTURE_RESEARCH_RUN,
  FIXTURE_RESEARCH_SOURCE,
  FIXTURE_RESEARCH_SOURCE_SLUG,
  FIXTURE_STAFF,
  fixtureDate,
  fixtureId,
} from '../../tests/fixtures/ids'

/**
 * `npm run test:seed-fixture -- [--reset] [--allow-remote]` — Phase 42.
 *
 * THE ONE DATABASE STATE EVERY BROWSER TEST RUNS AGAINST. Playwright cannot assert about a page
 * whose contents change between runs, and a visual snapshot of "3 days ago" fails on the fourth
 * day. So this writes a fixed set of rows, dated from a frozen clock, with ids nobody has to guess.
 *
 * WHAT IT WRITES, and why each count is what it is:
 *
 *   six staff users      one per role, so an authorisation test names a role rather than a person
 *   four products        ONE PER `price_state` — every price branch in the product has a row, and
 *                        the branch nobody tests is the one that ships a price for a product with
 *                        none
 *   one collection       OWNER_CONFIRMED, because `enforce_collection_publish_gate` refuses any
 *                        other published collection and it is right to
 *   one portfolio project DRAFT. See the note on `seedProject` — this is the one row the fixture
 *                        deliberately does not publish
 *   two journal articles  one published with a real body page, one draft
 *   ten FAQs             enough that the accordion's keyboard behaviour goes past the first item
 *   five inquiries       one per pipeline column the Studio list shows
 *   one research source, one run, twenty research products — twenty because the analytics floor is
 *                        twelve, and a fixture under the floor would only ever test the refusal
 *   twelve media assets  mirroring real manifest assets, public ids and all, so a fixture page
 *                        requests exactly the URL a real page would
 *
 * IT ONLY EVER TOUCHES ROWS WHOSE ID STARTS `f0000000-0000-4000-8000-`. Not one statement below
 * deletes by slug, by date or by "everything in this table". A developer running this against a
 * database holding a day of their own work gets the fixture written and their work untouched — and
 * `scripts/test/check-fixture-isolation.mjs` proves the prefix never leaks the other way.
 *
 * IT REFUSES A DATABASE THAT IS NOT ON THIS MACHINE unless `--allow-remote` is passed, and that is
 * the most important line in the file. The rows below carry invented prices, invented enquirer
 * names and phone numbers, and a `VERIFIED` owner-verification on four products no owner has
 * looked at. Every one of those is a fabricated business fact, which is fine in a throwaway test
 * database and is a straightforward breach of the house rules anywhere else.
 *
 * WHY IT TALKS TO POSTGRES DIRECTLY, like `scripts/seed/seed-content.ts`: it needs one transaction
 * — a half-written fixture is worse than none — and PostgREST cannot give it one. It reads nothing
 * through the application's data layer and `scripts/db/check-data-layer.mjs` stays satisfied.
 */

const ENV_PATH = '.env.local'

/** Timestamps, all derived from the frozen clock so a snapshot taken today matches one from March. */
const NOW = FIXTURE_NOW
const DAYS_AGO = (days: number): string => fixtureDate(-days).toISOString()

export interface Options {
  readonly reset: boolean
  readonly allowRemote: boolean
  readonly publishSeeded: boolean
}

export function parseArgs(argv: readonly string[]): Options | { readonly error: string } {
  let reset = false
  let allowRemote = false
  let publishSeeded = false
  for (const arg of argv) {
    if (arg === '--reset') reset = true
    else if (arg === '--allow-remote') allowRemote = true
    else if (arg === '--publish-seeded') publishSeeded = true
    else return { error: `Unrecognised argument: ${arg}` }
  }
  return { reset, allowRemote, publishSeeded }
}

/**
 * Publish the seeded page sections, so the public routes answer 200.
 *
 * `npm run seed:content` writes every section as DRAFT and never publishes one — that is its
 * central rule, because publishing is an editor's act and a runner that published would overwrite
 * the judgement it exists to protect. Correct in production, and it leaves a freshly seeded
 * database where EVERY public route 404s: an e2e suite against it skips every test and reports
 * green.
 *
 * IT IS A NAMED OPT-IN, `--publish-seeded`, AND OFF BY DEFAULT, because this is the one thing the
 * fixture does that reaches outside its own ids. A developer running the plain command gets their
 * database left exactly as they had it.
 *
 * IT REFUSES TO PUBLISH A SECTION MARKED `OWNER_VERIFICATION_REQUIRED`, which is not a technical
 * constraint — `page_sections_verified_before_publish` would refuse it anyway — but the reason the
 * constraint is right. Those sections assert real business capability. Leaving them DRAFT also
 * gives the suite the mixed state a live site is actually in, which is more useful to test against
 * than a site where everything happens to be live.
 *
 * `--reset` DOES NOT UNPUBLISH. There is no record of what was published before, and guessing would
 * be worse than leaving it.
 */
async function publishSeededContent(db: Client): Promise<{ pages: number; sections: number }> {
  /*
   * DRAFT → REVIEW → APPROVED → PUBLISHED, ONE STEP AT A TIME.
   *
   * `enforce_status_transition` refuses DRAFT → PUBLISHED outright, and it is right to: the whole
   * point of the ladder is that nothing reaches the public site without passing through review. The
   * fixture walks the same three steps an editor walks rather than disabling the trigger — a
   * fixture that had to switch off a rule to produce its state would be testing a database this
   * project does not ship.
   */
  const eligible = `seed_key is not null and owner_verification <> 'OWNER_VERIFICATION_REQUIRED'`
  let sections = 0
  for (const [from, to] of [
    ['DRAFT', 'REVIEW'],
    ['REVIEW', 'APPROVED'],
    ['APPROVED', 'PUBLISHED'],
  ] as const) {
    const result = await db.query(
      `update page_sections
          set status = $2::content_status,
              published_at = case when $2 = 'PUBLISHED' then coalesce(published_at, $1::timestamptz)
                                  else published_at end
        where ${eligible} and status = $3::content_status`,
      [NOW, to, from],
    )
    if (to === 'PUBLISHED') sections = result.rowCount ?? 0
  }

  let pages = 0
  for (const [from, to] of [
    ['DRAFT', 'REVIEW'],
    ['REVIEW', 'APPROVED'],
    ['APPROVED', 'PUBLISHED'],
  ] as const) {
    const result = await db.query(
      `update pages
          set status = $2::content_status,
              published_at = case when $2 = 'PUBLISHED' then coalesce(published_at, $1::timestamptz)
                                  else published_at end
        where ${eligible} and status = $3::content_status`,
      [NOW, to, from],
    )
    if (to === 'PUBLISHED') pages = result.rowCount ?? 0
  }

  return { pages, sections }
}

/**
 * Is this connection string pointing at this machine?
 *
 * HOSTNAME ONLY, and deliberately conservative: anything that is not a loopback name is remote.
 * A tunnel on localhost would pass, which is a hole a person has to dig on purpose; a hosted
 * Supabase URL pasted in by accident, which is the case this exists for, does not.
 */
export function isLocal(connectionString: string): boolean {
  let host: string
  try {
    host = new URL(connectionString).hostname
  } catch {
    // A libpq keyword string ("host=… dbname=…") has no host in URL terms. Treat it as remote.
    return false
  }
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === ''
}

type Client = pg.Client

// --- the wipe ------------------------------------------------------------------------------------

/**
 * Every fixture row, removed in dependency order.
 *
 * Each statement is bounded by the id prefix or by a foreign key to a row that is. The join tables
 * come first, then the rows they point at, then the users everything attributes to.
 */
async function wipe(db: Client): Promise<void> {
  const like = `${FIXTURE_ID_PREFIX}%`

  /*
   * NO EXPLICIT `delete from inquiry_events`. The table is append-only and
   * `reject_inquiry_event_mutation` refuses a direct delete outright — an event may leave only WITH
   * the enquiry it belongs to, which the cascade below does. `inquiries_log_created` writes an
   * event for every row this fixture inserts, so there is always something to cascade.
   */
  await db.query('delete from inquiries where id::text like $1', [like])

  /*
   * AN ENQUIRY THAT NAMES A FIXTURE PRODUCT IS FIXTURE DATA, whatever its own id.
   *
   * `tests/e2e/inquiry-conversion.spec.ts` drives the real form, so the row it creates gets a real
   * id from the application rather than a prefixed one. `inquiries.product_id` is ON DELETE SET
   * NULL — correct in production, because losing an enquiry when a product is retired would be
   * worse — and `inquiries_product_kind_has_product` refuses a PRODUCT enquiry with no product. So
   * deleting a fixture product with such a row still present fails the constraint, three statements
   * later, with a message about a table the wipe had already finished.
   *
   * The constraint is right and the wipe was wrong. Found by running the whole suite in order,
   * which is the only way this surfaces: seed, drive the browser, seed again.
   */
  await db.query(
    'delete from inquiries where product_id::text like $1 or collection_id::text like $1',
    [like],
  )

  await db.query('delete from research_products where id::text like $1', [like])
  await db.query('delete from research_runs where id::text like $1', [like])
  await db.query('delete from research_sources where id::text like $1', [like])

  await db.query('delete from product_media where product_id::text like $1', [like])
  await db.query('delete from product_collections where product_id::text like $1', [like])
  await db.query('delete from portfolio_project_media where project_id::text like $1', [like])

  await db.query('delete from faqs where id::text like $1', [like])
  await db.query('delete from journal_articles where id::text like $1', [like])
  await db.query('delete from portfolio_projects where id::text like $1', [like])
  await db.query('delete from products where id::text like $1', [like])
  await db.query('delete from collections where id::text like $1', [like])

  /*
   * SECTIONS BEFORE PAGES, and pages before the media the sections point at. `page_sections` has no
   * cascade to `media_assets` — the attribution convention — so a media row still referenced by a
   * section refuses to go.
   */
  await db.query('delete from page_sections where id::text like $1', [like])
  await db.query('delete from pages where id::text like $1', [like])
  await db.query('delete from media_assets where id::text like $1', [like])

  /*
   * `content_revisions.created_by` and `entity_relations.created_by` reference `auth.users` with no
   * ON DELETE action, which is the house convention and is right: losing who made an edit is worse
   * than a blocked delete. A suite that attributed a write to a fixture user therefore leaves a row
   * that makes the NEXT wipe fail on a foreign key, in a different file, about a table it does not
   * test. Detaching keeps the trail and lets the user go.
   */
  await db.query('update content_revisions set created_by = null where created_by::text like $1', [
    like,
  ])
  await db.query('delete from entity_relations where created_by::text like $1', [like])
  await db.query('delete from staff_profiles where user_id::text like $1', [like])
  await db.query('delete from auth.users where id::text like $1', [like])
}

// --- the rows ------------------------------------------------------------------------------------

async function seedStaff(db: Client): Promise<void> {
  /*
   * The `staff_profiles` insert trigger creates every new user as INVITED/viewer, which is the
   * invite-then-promote path a real account goes through. Elevating afterwards is therefore the
   * honest shape, not a workaround.
   */
  for (const [role, id] of Object.entries(FIXTURE_STAFF)) {
    await db.query('insert into auth.users (id, email) values ($1, $2)', [
      id,
      FIXTURE_EMAIL[role as keyof typeof FIXTURE_EMAIL],
    ])
    await db.query(
      `update staff_profiles set role = $2::user_role, status = 'ACTIVE', display_name = $3
         where user_id = $1`,
      [id, role, `Fixture ${role}`],
    )
  }
}

async function seedMedia(db: Client): Promise<void> {
  for (const asset of FIXTURE_MEDIA) {
    const ratio = `${String(asset.width)}:${String(asset.height)}`
    await db.query(
      `insert into media_assets
         (id, provider, resource_type, public_id, folder, filename, rivya_asset_id, kind, alt_text,
          is_ai_generated, is_concept, width, height, aspect_ratio, status, owner_verification,
          fact_classification, source, manifest_version, created_at, updated_at)
       values ($1,'cloudinary','image',$2,$3,$4,$5,'IMAGE',$6,true,false,$7,$8,$9,
               'PUBLISHED','NOT_REQUIRED','EDITORIAL_COPY','HIGGSFIELD','rivya-hf-v1',$10,$10)`,
      [
        asset.id,
        asset.publicId,
        asset.publicId.split('/').slice(0, -1).join('/'),
        asset.file,
        asset.assetId,
        `Fixture image standing in for ${asset.assetId}.`,
        asset.width,
        asset.height,
        ratio,
        NOW,
      ],
    )
  }
}

/** The body page a published journal article needs, plus its one visible section. */
async function seedArticlePage(db: Client): Promise<string> {
  const pageId = fixtureId('media', 90)
  const sectionId = fixtureId('media', 91)
  await db.query(
    `insert into pages (id, slug, path, kind, title, status, owner_verification,
                        fact_classification, created_at, updated_at, published_at)
     values ($1,$2,$3,'ARTICLE',$4,'PUBLISHED','NOT_REQUIRED','EDITORIAL_COPY',$5,$5,$5)`,
    [
      pageId,
      FIXTURE_ARTICLE_SLUG.published,
      `/journal/${FIXTURE_ARTICLE_SLUG.published}`,
      'Choosing a resin table',
      NOW,
    ],
  )
  /*
   * A `hero` THEN A `statement`, WITH THE HERO'S PAYLOAD, and every part of that is load-bearing.
   *
   *   `hero` FIRST is what produces the `h1`: `HeroSection` renders its heading at level 1 when it
   *   is the page's first section and at level 2 otherwise, and no other block emits an `h1` at
   *   all. An article page without one is an article with no title in the outline.
   *
   *   THE PAYLOAD IS NOT `{}`. `parseBlockPayload(heroBlock, …)` needs the three keys the seeded
   *   heroes carry; with an empty object the section renders nothing and the page comes back 200
   *   and blank — which is exactly what the first version of this fixture produced, and what
   *   `tests/e2e/journal.spec.ts` caught.
   *
   *   `statement`, NOT `RICH_TEXT`. There is no `RICH_TEXT` renderer in this build: `unrenderable()`
   *   drops any block type the section registry does not know, silently in production. The
   *   `RICH_TEXT` rows in this database are debris from an RLS suite, not a block the site can draw
   *   — a fixture is only useful if every row in it is one the product would actually accept.
   */
  await db.query(
    `insert into page_sections (id, page_id, block_type, layout_variant, position, is_visible,
                                heading, body, payload, status, owner_verification,
                                fact_classification, created_at, updated_at)
     values ($1,$2,'hero','contained',0,true,$3,$4,
             '{"scrim": 30, "autoplay": false, "is_video": false}'::jsonb,
             'PUBLISHED','NOT_REQUIRED','EDITORIAL_COPY',$5,$5),
            ($6,$2,'statement',null,1,true,$7,$8,'{}'::jsonb,
             'PUBLISHED','NOT_REQUIRED','EDITORIAL_COPY',$5,$5)`,
    [
      sectionId,
      pageId,
      'Choosing a resin table',
      'Fixture standfirst, rendered by the hero block.',
      NOW,
      fixtureId('media', 92),
      'What a resin table has to survive',
      'Fixture body copy. It exists so the article has a body, which is what ' +
        '`enforce_article_has_body` requires before an article may be published.',
    ],
  )
  return pageId
}

async function categoryId(db: Client, slug: string): Promise<string> {
  /*
   * LOOKED UP, NEVER HARD-CODED. Category ids are allocated by the content seed and differ between
   * databases, so a literal here would work on one machine and fail on CI with a foreign-key error
   * naming a table the fixture is not about.
   */
  const rows = await db.query<{ id: string }>('select id from categories where slug = $1', [slug])
  const id = rows.rows[0]?.id
  if (id === undefined) {
    throw new Error(
      `No category "${slug}". Run \`npm run seed:content\` first — the fixture builds on the seeded taxonomy rather than inventing one.`,
    )
  }
  return id
}

/**
 * FOUR PRODUCTS, ONE PER `price_state`.
 *
 * The two priced ones carry `owner_verification = 'VERIFIED'`, which in production means a person
 * confirmed the figure. Here it means the fixture intends it: `products_price_state_coherent`
 * refuses a FIXED product without a price, and `products_verified_before_publish` refuses a
 * published product that still needs verification, so a published FIXED product cannot exist any
 * other way. That is exactly why this script refuses a remote database.
 */
async function seedProducts(db: Client): Promise<void> {
  const furniture = await categoryId(db, 'furniture')
  const collectible = await categoryId(db, 'collectible-design')
  const decor = await categoryId(db, 'decor')

  const rows: readonly [
    string,
    string,
    string,
    string,
    string,
    number | null,
    number | null,
    string | null,
    string,
    boolean,
  ][] = [
    [
      FIXTURE_PRODUCTS.startingFrom,
      FIXTURE_PRODUCT_SLUG.startingFrom,
      'Fixture Resin Dining Table',
      'STARTING_FROM',
      furniture,
      null,
      18_500_00,
      'INR',
      FIXTURE_MEDIA[0]!.id,
      true,
    ],
    [
      FIXTURE_PRODUCTS.requestQuote,
      FIXTURE_PRODUCT_SLUG.requestQuote,
      'Fixture Timber Console',
      'REQUEST_QUOTE',
      furniture,
      null,
      null,
      null,
      FIXTURE_MEDIA[1]!.id,
      true,
    ],
    [
      FIXTURE_PRODUCTS.priceOnRequest,
      FIXTURE_PRODUCT_SLUG.priceOnRequest,
      'Fixture Collectible Bench',
      'PRICE_ON_REQUEST',
      collectible,
      null,
      null,
      null,
      FIXTURE_MEDIA[2]!.id,
      true,
    ],
    [
      FIXTURE_PRODUCTS.fixed,
      FIXTURE_PRODUCT_SLUG.fixed,
      'Fixture Resin Coaster Set',
      'FIXED',
      decor,
      4_800_00,
      null,
      'INR',
      FIXTURE_MEDIA[3]!.id,
      false,
    ],
  ]

  for (const [
    id,
    slug,
    title,
    priceState,
    category,
    priceMinor,
    priceFromMinor,
    currency,
    heroId,
    isLargeFormat,
  ] of rows) {
    await db.query(
      `insert into products
         (id, slug, title, summary, description, category_id, price_state, price_minor,
          price_from_minor, currency, is_large_format, hero_media_id, status, owner_verification,
          fact_classification, is_customizable, sort_order, created_at, updated_at, published_at)
       values ($1,$2,$3,$4,$5,$6,$7::price_state,$8,$9,$10,$11,$12,'PUBLISHED','VERIFIED',
               'PRODUCT_FACT',$13,$14,$15,$15,$15)`,
      [
        id,
        slug,
        title,
        `Fixture summary for ${title}.`,
        `Fixture description for ${title}. Every word here is test data.`,
        category,
        priceState,
        priceMinor,
        priceFromMinor,
        currency,
        isLargeFormat,
        heroId,
        priceState !== 'FIXED',
        rows.findIndex((row) => row[0] === id),
        NOW,
      ],
    )
    await db.query(
      `insert into product_media (product_id, media_asset_id, role, sort_order) values ($1,$2,'hero',0)`,
      [id, heroId],
    )
  }
}

async function seedCollection(db: Client): Promise<void> {
  /*
   * OWNER_CONFIRMED, because `enforce_collection_publish_gate` refuses a published collection that
   * is still a concept — FEAT §9 says a collection is a proposal until the owner says it is real,
   * so "published but unconfirmed" is a state the business does not have.
   */
  await db.query(
    `insert into collections
       (id, slug, name, statement, concept_state, hero_media_id, sort_order, status,
        owner_verification, fact_classification, created_at, updated_at, published_at,
        owner_confirmed_at, owner_confirmed_by)
     values ($1,$2,$3,$4,'OWNER_CONFIRMED',$5,0,'PUBLISHED','VERIFIED','BRAND_COPY',$6,$6,$6,$6,$7)`,
    [
      FIXTURE_COLLECTION,
      FIXTURE_COLLECTION_SLUG,
      'Fixture River Series',
      'Fixture collection statement.',
      FIXTURE_MEDIA[4]!.id,
      NOW,
      FIXTURE_STAFF.owner,
    ],
  )
  for (const productId of [FIXTURE_PRODUCTS.startingFrom, FIXTURE_PRODUCTS.requestQuote]) {
    await db.query(
      'insert into product_collections (product_id, collection_id, sort_order) values ($1,$2,0)',
      [productId, FIXTURE_COLLECTION],
    )
  }
}

/**
 * THE ONE ROW THIS FIXTURE WILL NOT PUBLISH.
 *
 * `enforce_project_evidence_gate` refuses a published project unless `owner_verification` is
 * VERIFIED, and a portfolio project asserts that Rivya DELIVERED this piece of work for somebody.
 * Marking a fabricated one verified would put the shape of a false claim into the one table whose
 * whole purpose is to hold true ones — and a fixture is copied far more often than it is read.
 *
 * So it stays DRAFT, which is also the truer test: the live site has no published projects today,
 * so `/portfolio` renders its empty state, and that is what a visual snapshot should capture.
 */
async function seedProject(db: Client): Promise<void> {
  await db.query(
    `insert into portfolio_projects
       (id, slug, title, subtitle, summary, project_type, is_client_project, client_consent,
        hero_media_id, sort_order, status, owner_verification, fact_classification,
        created_at, updated_at)
     values ($1,$2,$3,$4,$5,'Commission',false,'NOT_APPLICABLE',$6,0,'DRAFT',
             'OWNER_VERIFICATION_REQUIRED','EDITORIAL_COPY',$7,$7)`,
    [
      FIXTURE_PROJECT,
      FIXTURE_PROJECT_SLUG,
      'Fixture Studio Commission',
      'Fixture subtitle.',
      'Fixture project summary. This row is DRAFT on purpose — see seed-fixture.ts.',
      FIXTURE_MEDIA[5]!.id,
      NOW,
    ],
  )
}

async function seedArticles(db: Client, pageId: string): Promise<void> {
  await db.query(
    `insert into journal_articles
       (id, slug, page_id, title, standfirst, excerpt, byline, cover_media_id, reading_minutes,
        status, owner_verification, fact_classification, created_at, updated_at, published_at)
     values ($1,$2,$3,$4,$5,$6,'Rivya Studio',$7,4,'PUBLISHED','NOT_REQUIRED','EDITORIAL_COPY',$8,$8,$8)`,
    [
      FIXTURE_ARTICLES.published,
      FIXTURE_ARTICLE_SLUG.published,
      pageId,
      'Choosing a resin table',
      'Fixture standfirst for the published article.',
      'Fixture excerpt.',
      FIXTURE_MEDIA[10]!.id,
      NOW,
    ],
  )
  await db.query(
    `insert into journal_articles
       (id, slug, title, standfirst, excerpt, byline, cover_media_id, status, owner_verification,
        fact_classification, created_at, updated_at)
     values ($1,$2,$3,$4,$5,'Rivya Studio',$6,'DRAFT','NOT_REQUIRED','EDITORIAL_COPY',$7,$7)`,
    [
      FIXTURE_ARTICLES.draft,
      FIXTURE_ARTICLE_SLUG.draft,
      'Inside the workshop',
      'Fixture standfirst for the draft article.',
      'Fixture excerpt.',
      FIXTURE_MEDIA[11]!.id,
      NOW,
    ],
  )
}

async function seedFaqs(db: Client): Promise<void> {
  const categories = ['Ordering', 'Materials', 'Delivery', 'Care', 'Commissions']
  for (const [index, id] of FIXTURE_FAQS.entries()) {
    await db.query(
      `insert into faqs (id, question, answer, category, position, status, owner_verification,
                         fact_classification, created_at, updated_at, published_at)
       values ($1,$2,$3,$4,$5,'PUBLISHED','NOT_REQUIRED','EDITORIAL_COPY',$6,$6,$6)`,
      [
        id,
        `Fixture question ${String(index + 1)}?`,
        `Fixture answer ${String(index + 1)}. Long enough to wrap onto a second line in the accordion.`,
        categories[index % categories.length],
        index,
        NOW,
      ],
    )
  }
}

/**
 * FIVE INQUIRIES, ONE PER PIPELINE COLUMN, each dated a different number of days before the frozen
 * clock so "oldest first" has something to sort.
 *
 * THE NAMES AND NUMBERS ARE INVENTED, and the numbers are from the reserved 555 range that reaches
 * nobody. This is the table this script's remote-database refusal exists for: five plausible people
 * with phone numbers, written into the table the studio actually rings.
 */
async function seedInquiries(db: Client): Promise<void> {
  const rows: readonly [string, string, string, string, string, string, number][] = [
    [FIXTURE_INQUIRIES.new, 'NEW', 'PRODUCT', 'Fixture Asha', '+15555550101', 'Mumbai', 1],
    [FIXTURE_INQUIRIES.contacted, 'READ', 'COMMISSION', 'Fixture Devan', '+15555550102', 'Pune', 4],
    [
      FIXTURE_INQUIRIES.qualified,
      'IN_CONVERSATION',
      'QUOTE',
      'Fixture Meera',
      '+15555550103',
      'Surat',
      9,
    ],
    [FIXTURE_INQUIRIES.won, 'WON', 'PRODUCT', 'Fixture Rohan', '+15555550104', 'Delhi', 21],
    [FIXTURE_INQUIRIES.lost, 'LOST', 'GENERAL', 'Fixture Nila', '+15555550105', 'Kochi', 45],
  ]

  for (const [id, status, kind, name, phone, city, daysAgo] of rows) {
    await db.query(
      `insert into inquiries
         (id, reference_code, kind, pipeline_status, source_path, product_id, name, phone, email,
          city, message, consent_contact, whatsapp_state, created_at, updated_at)
       values ($1,'RIV-2026-000000',$2::inquiry_kind,$3::inquiry_status,$4,$5,$6,$7,$8,$9,$10,true,
               'NOT_SENT',$11,$11)`,
      [
        id,
        kind,
        status,
        `/products/${FIXTURE_PRODUCT_SLUG.startingFrom}`,
        kind === 'PRODUCT' ? FIXTURE_PRODUCTS.startingFrom : null,
        name,
        phone,
        `${name.toLowerCase().replace(/\s+/g, '.')}@fixture.test`,
        city,
        `Fixture enquiry message from ${name}.`,
        DAYS_AGO(daysAgo),
      ],
    )
    /*
     * `allocate_inquiry_reference` overwrites `reference_code` on every insert — it is how a real
     * enquiry gets its code, from a sequence, and the fixture has no business disabling a trigger to
     * dodge it. Setting the code afterwards leaves the production path exactly as it is.
     */
    const key = (Object.keys(FIXTURE_INQUIRIES) as (keyof typeof FIXTURE_INQUIRIES)[]).find(
      (name_) => FIXTURE_INQUIRIES[name_] === id,
    )
    if (key !== undefined) {
      await db.query('update inquiries set reference_code = $2 where id = $1', [
        id,
        FIXTURE_INQUIRY_REFERENCE[key],
      ])
    }
  }
}

/**
 * ONE SOURCE, ONE RUN, TWENTY PRODUCTS.
 *
 * The prices span two bands and the dimensions span the large-format threshold, so an assortment or
 * price-architecture computation over this corpus produces more than one bucket. Twenty clears the
 * twelve-observation floor those modules refuse to compute below.
 *
 * `source_url` points at `example.com`, which is reserved by RFC 2606 and belongs to nobody. A
 * fixture naming a real competitor would put that name into a repository, into CI logs and into
 * every developer's local database — research data is research only (D10), and that starts here.
 */
async function seedResearch(db: Client): Promise<void> {
  await db.query(
    /*
     * APPROVED, ATTRIBUTED AND REVIEWED, because the database refuses any other combination:
     * `research_sources_enabled_requires_approval` refuses an enabled source that nobody approved,
     * and `research_sources_approval_is_attributed` refuses an approval with no reviewer and no
     * date. A source Rivya may fetch is a decision a named person made — the fixture attributes it
     * to the fixture owner rather than relaxing the rule.
     */
    `insert into research_sources
       (id, slug, name, base_url, region, currency, source_type, is_enabled, adapter_key,
        policy_status, policy_reviewed_by, policy_reviewed_at, status, collection_mode,
        image_extraction_mode, readiness, created_at, updated_at)
     values ($1,$2,'Fixture Source','https://research.example.com','IN','INR','BRAND',true,
             'generic','APPROVED',$4,$3,'PUBLISHED','SEED_URLS','URL_ONLY','REVIEWED',$3,$3)`,
    [FIXTURE_RESEARCH_SOURCE, FIXTURE_RESEARCH_SOURCE_SLUG, NOW, FIXTURE_STAFF.owner],
  )

  await db.query(
    // `research_runs_manual_has_actor`: a MANUAL run is one somebody started, so it must say who.
    `insert into research_runs
       (id, source_id, status, trigger, requested_by, queued_at, started_at, finished_at, stats,
        is_dry_run)
     values ($1,$2,'SUCCEEDED','MANUAL',$6,$3,$3,$4,$5,false)`,
    [
      FIXTURE_RESEARCH_RUN,
      FIXTURE_RESEARCH_SOURCE,
      DAYS_AGO(2),
      DAYS_AGO(2),
      JSON.stringify({ fetched: 20, normalized: 20, failed: 0 }),
      FIXTURE_STAFF.researcher,
    ],
  )

  for (const [index, id] of FIXTURE_RESEARCH_PRODUCTS.entries()) {
    const n = index + 1
    // Two price bands and a dimension either side of the large-format threshold.
    const priceMinor = (n <= 10 ? 12_000_00 : 96_000_00) + n * 1_000_00
    const longestAxis = n <= 10 ? 900 : 2_200
    await db.query(
      `insert into research_products
         (id, source_id, source_url, source_external_id, stage, disposition, first_seen_at,
          last_seen_at, first_seen_run_id, last_seen_run_id, status, title_normalized, brand_text,
          currency, price_state, price_min_minor, price_max_minor, dimensions_mm,
          dimension_parse_state, material_tokens, availability, image_urls, category_labels,
          scale_band, is_large_format, longest_axis_mm, large_format_source, classified_at,
          created_at, updated_at)
       values ($1,$2,$3,$4,'NORMALIZED','NONE',$5,$5,$6,$6,'DRAFT',$7,'Fixture Brand','INR',
               'FIXED',$8,$8,$9,'PARSED',$10,'MADE_TO_ORDER',$11,$12,$13,$14,$15,'RULE',$5,$5,$5)`,
      [
        id,
        FIXTURE_RESEARCH_SOURCE,
        `https://research.example.com/product/${String(n)}`,
        `fixture-${String(n)}`,
        DAYS_AGO(2),
        FIXTURE_RESEARCH_RUN,
        `fixture research product ${String(n)}`,
        priceMinor,
        // Keys from `is_sane_research_dimensions`' allowlist; anything else fails the CHECK.
        JSON.stringify({ length_mm: longestAxis, width_mm: 800, height_mm: 750 }),
        [n % 2 === 0 ? 'resin' : 'timber'],
        [`https://research.example.com/image/${String(n)}.jpg`],
        [n <= 10 ? 'Side tables' : 'Dining tables'],
        // From `research_products_scale_band_check`'s allowlist, not an invented word.
        longestAxis >= 1_800 ? 'DINING' : 'SIDE',
        longestAxis >= 1_800,
        longestAxis,
      ],
    )
  }
}

// --- the run -------------------------------------------------------------------------------------

export async function seedFixture(db: Client, options: Options): Promise<void> {
  await db.query('begin')
  try {
    /*
     * THE WIPE RUNS ON EVERY PATH, not only under `--reset`, because that is what makes this
     * idempotent: writing the declared set over whatever is there leaves exactly the declared set.
     * What `--reset` adds is the wipe running when there is nothing to write afterwards, which is
     * how a developer takes the fixture back OUT of their database.
     */
    await wipe(db)
    if (options.reset) {
      await db.query('commit')
      console.log('✓ fixture removed. Every row whose id began the fixture prefix is gone.')
      return
    }

    await seedStaff(db)
    await seedMedia(db)
    const pageId = await seedArticlePage(db)
    await seedProducts(db)
    await seedCollection(db)
    await seedProject(db)
    await seedArticles(db, pageId)
    await seedFaqs(db)
    await seedInquiries(db)
    await seedResearch(db)

    if (options.publishSeeded) {
      const published = await publishSeededContent(db)
      console.log(
        `  published ${String(published.sections)} seeded section(s) and ${String(published.pages)} page(s); ` +
          'anything OWNER_VERIFICATION_REQUIRED stays DRAFT',
      )
    }

    await db.query('commit')
  } catch (error) {
    await db.query('rollback')
    throw error
  }
}

async function main(): Promise<void> {
  if (existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH)

  const parsed = parseArgs(process.argv.slice(2))
  if ('error' in parsed) {
    console.error(parsed.error)
    process.exit(2)
  }

  const connectionString = process.env.DATABASE_URL
  if (connectionString === undefined || connectionString === '') {
    console.error('DATABASE_URL is not set — there is nothing to seed.')
    process.exit(1)
  }

  if (!isLocal(connectionString) && !parsed.allowRemote) {
    console.error(
      '✗ refusing a database that is not on this machine.\n\n' +
        '  This fixture writes invented prices, invented enquirer names and phone numbers, and a\n' +
        '  VERIFIED owner-verification on four products no owner has looked at. That is fine in a\n' +
        '  throwaway database and a breach of the house rules anywhere else.\n\n' +
        '  If you are certain, pass --allow-remote.',
    )
    process.exit(1)
  }

  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await seedFixture(db, parsed)
    if (!parsed.reset) {
      console.log(
        `✓ fixture seeded at the frozen clock ${NOW}: ` +
          `6 staff, ${String(FIXTURE_MEDIA.length)} media, 4 products (one per price_state), ` +
          `1 collection, 1 project (DRAFT, deliberately), 2 articles, ` +
          `${String(FIXTURE_FAQS.length)} FAQs, 5 inquiries, ` +
          `1 research source + run + ${String(FIXTURE_RESEARCH_PRODUCTS.length)} products.`,
      )
    }
  } finally {
    await db.end()
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
