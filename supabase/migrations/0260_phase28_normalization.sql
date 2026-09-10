-- ============================================================================================
-- 0260 — Phase 28: the strings become comparable data, and the data is judged before it is trusted
--
-- THE GOVERNING PRINCIPLE IS THAT A VALUE RIVYA COULD NOT PARSE IS RECORDED AS *UNPARSED*, NEVER AS
-- A GUESS. Every column below that holds a parsed value has a `*_parse_state` beside it or a state
-- enum in front of it, because every downstream comparison, opportunity score and large-format
-- decision inherits this phase's first judgement. A dimension inferred from a magnitude, a currency
-- inferred from a `$`, a category defaulted to the first one — each is a number nobody measured
-- that Phase 31 then charts and Phase 34 then reasons from.
--
-- THE SECOND AND FINAL RESEARCH → PUBLIC FOREIGN KEY IS CREATED HERE, BY NAME:
-- `research_products_matched_category_fk`. Amendment A26 records the exception in D5's own terms —
-- a scraped VALUE never joins to a public table, while a STAFF-AUTHORED TAXONOMY POINTER with
-- `on delete set null` may — and the isolation guard allowlists exactly two constraints and fails on
-- a third. **There is never a third.** Note what this column is NOT: it is not a link to a product,
-- it is not written by the pipeline from anything a page said unless a human-authored mapping row
-- put it there, and clearing it unmaps rather than deletes.
--
-- TWO CHECK CONSTRAINTS ARE BACKSTOPS AND NOT THE ENFORCEMENT POINT, AND THE DISTINCTION IS THE
-- WHOLE DESIGN OF THIS PHASE. Every validation rule runs in `lib/scraper/validation/rules.ts`
-- BEFORE the write, and a row that fails one is STORED — at `VALIDATED`, with the issue attached and
-- the offending value nulled — rather than refused. If the constraint were the enforcement point,
-- the normalizer would raise a database error instead of persisting a flagged row, and a row that
-- cannot be stored is a row nobody can see, count, or come back to. The constraints exist for a
-- hand-written `UPDATE` and for nothing else.
--
-- THE LEXICON IS DATA. `research_material_lexicon` is seeded here as CONFIGURATION — a parsing
-- vocabulary for other people's words, not a claim about what Rivya makes — so that a material
-- Rivya has never heard of is added in Studio and rolled out over stored versions by
-- `scripts/research/renormalize.ts`, with no deploy and no network traffic.
--
-- NO CURRENCY IS EVER CONVERTED, HERE OR ANYWHERE. Comparing a price across currencies needs a
-- dated rate Rivya does not hold; Phase 31 compares within a currency and says so.
-- ============================================================================================

set search_path = public, extensions;

-- --- 1. What a normalised product knows about itself ---------------------------------------------

alter table research_products
  -- The title as the normalizer left it: trimmed, whitespace-collapsed, case preserved. Used for
  -- the trigram duplicate check and as the search document's title.
  add column title_normalized text,
  add column brand_text       text,

  -- FEAT §26 field 4's currency, carried onto the row so a price is never a bare number. `char(3)`
  -- matching `research_sources.currency`, and NEVER converted.
  add column currency         char(3),

  /*
   * PRICE STATE MIRRORS THE FIRST-PARTY VOCABULARY, and that is not decoration. `products` already
   * carries FIXED · STARTING_FROM · REQUEST_QUOTE · PRICE_ON_REQUEST, and Phase 31 will put a
   * Rivya row beside a research row in the same table. Two vocabularies for one idea would mean
   * every comparison began with a translation somebody would eventually get wrong in one direction.
   * `UNKNOWN` is the fifth value and is this table's alone: a first-party product always has a
   * decided price posture, and a page Rivya could not read does not.
   */
  add column price_state      text,
  add column price_min_minor  bigint,
  add column price_max_minor  bigint,

  -- MILLIMETRES, AS INTEGERS, IN A JSONB OBJECT. An object rather than five columns because the
  -- KEYS carry meaning — `length_mm` and `diameter_mm` are alternatives, not both-nullable
  -- siblings — and a row with a diameter has no length to leave null.
  add column dimensions_mm    jsonb,
  add column dimension_parse_state text,

  add column material_tokens  text[] not null default '{}',
  add column availability     text,
  add column lead_time_days_min int,
  add column lead_time_days_max int,
  add column variant_count    int,

  -- STRINGS. Nothing downloads, caches, re-hosts, thumbnails or measures an image, in this phase or
  -- any other. `research_sources.image_extraction_mode` decides whether the address is kept at all.
  add column image_urls       text[] not null default '{}',
  add column category_labels  text[] not null default '{}',

  -- THE SECOND AND FINAL CROSSING. See the header, and A26.
  add column matched_category_id uuid,
  add column match_confidence numeric(4,3),
  add column match_method     text,

  -- Self-referential: the row that survives. Set only at confidence ≥ 0.95 with title AND dimension
  -- agreement, or by a merchandiser's hand — and always reversible.
  add column duplicate_of_id  uuid,

  /*
   * WHICH KEYS A PERSON HAS CORRECTED, AND THEREFORE WHICH THE NORMALIZER MAY NOT TOUCH AGAIN.
   * `renormalize.ts` re-derives every value from stored evidence and skips these, reporting the
   * count. Without it, the first lexicon fix after a researcher corrected a price would silently
   * undo the correction — and the researcher would have no way to know, because re-normalisation
   * is a background job over rows nobody is watching.
   */
  add column normalized_overrides jsonb not null default '{}'::jsonb,
  add column override_by      uuid references auth.users (id),
  add column override_at      timestamptz;

/*
 * WHY A FUNCTION AND NOT THE PHASE DOCUMENT'S INLINE `not exists (select 1 from jsonb_each(...))`.
 *
 * PostgreSQL refuses a subquery in a CHECK constraint — `cannot use subquery in check constraint` —
 * and testing "every value in this object is a number in range" needs to walk the object. An
 * IMMUTABLE function may be called from a check and can hold the subquery the constraint cannot.
 * `is_valid_dimensions` in `0130` met exactly this and took exactly this shape; the phase
 * document's SQL was written as illustration and does not apply as given (amendment A28).
 *
 * THE KEY SET IS AN ALLOWLIST, so a normalizer that invented `depth_cm` — a unit in a key that
 * promises millimetres — is refused rather than stored. `*_max` keys are admitted because
 * `parseDimensions` records a RANGE as `length_mm` plus `length_mm_max`, which is a real shape a
 * furniture page produces ("120–140 cm") and one this table must be able to hold.
 *
 * THE VALUE TEST IS A SINGLE CASE rather than two conditions, so the numeric cast is only reached
 * for a value already known to be a number. Two `not exists` clauses would rely on AND
 * short-circuiting, which SQL does not promise — `0130` records the same reasoning.
 */
create or replace function public.is_sane_research_dimensions(value jsonb) returns boolean
  language sql
  immutable
  set search_path = pg_catalog, public
  as $$
  select value is null
      or (
        jsonb_typeof(value) = 'object'
        and value - array['length_mm', 'length_mm_max', 'width_mm', 'width_mm_max',
                          'height_mm', 'height_mm_max', 'depth_mm', 'depth_mm_max',
                          'diameter_mm', 'diameter_mm_max'] = '{}'::jsonb
        and not exists (
          select 1
            from jsonb_each(value) as d(key, val)
           where case
                   when jsonb_typeof(d.val) = 'number'
                     then (d.val)::numeric < 10 or (d.val)::numeric > 10000
                   else true
                 end
        )
      )
$$;

comment on function public.is_sane_research_dimensions(jsonb) is
  'True when a research_products.dimensions_mm blob is null, or an object whose keys are a subset of the ten declared millimetre measurements and whose every value is between 10 and 10 000. A BACKSTOP: impossible_dimension nulls the column before the write, so this fires for a hand-written UPDATE and for nothing else.';

/*
 * A CONSTRAINT FUNCTION IS EVALUATED AS THE WRITING USER, so `authenticated` keeps EXECUTE — see
 * `0022`, `0143` and `tests/unit/rls/function-grants.test.ts`. Revoking it would not harden
 * anything; it would make `research_products` unwritable by staff with an error naming a function
 * no researcher has heard of. `anon` writes nothing here and `public` is revoked because
 * PostgreSQL's default grant is what turns a new function into a PostgREST RPC endpoint.
 */
revoke execute on function public.is_sane_research_dimensions(jsonb) from public, anon;
grant execute on function public.is_sane_research_dimensions(jsonb) to authenticated, service_role;

alter table research_products
  add constraint research_products_matched_category_fk
    foreign key (matched_category_id) references categories (id) on delete set null,
  add constraint research_products_duplicate_fk
    foreign key (duplicate_of_id) references research_products (id) on delete set null,

  -- A ROW IS NOT ITS OWN DUPLICATE. Storable otherwise, and the query that walks a duplicate chain
  -- would loop on it.
  add constraint research_products_duplicate_is_another
    check (duplicate_of_id is null or duplicate_of_id <> id),

  add constraint research_products_price_state_allowlist
    check (price_state is null
           or price_state in ('FIXED', 'STARTING_FROM', 'REQUEST_QUOTE', 'PRICE_ON_REQUEST', 'UNKNOWN')),
  add constraint research_products_dimension_parse_state_allowlist
    check (dimension_parse_state is null
           or dimension_parse_state in ('PARSED', 'AMBIGUOUS', 'UNPARSED', 'ABSENT')),
  add constraint research_products_availability_allowlist
    check (availability is null
           or availability in ('IN_STOCK', 'MADE_TO_ORDER', 'PREORDER', 'SOLD_OUT', 'UNKNOWN')),
  add constraint research_products_match_method_allowlist
    check (match_method is null or match_method in ('MAP', 'KEYWORD', 'MANUAL')),
  add constraint research_products_match_confidence_range
    check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 1)),
  add constraint research_products_overrides_is_object
    check (jsonb_typeof(normalized_overrides) = 'object'),
  add constraint research_products_lead_time_ordered
    check (lead_time_days_min is null or lead_time_days_max is null
           or lead_time_days_max >= lead_time_days_min),
  add constraint research_products_price_range_ordered
    check (price_min_minor is null or price_max_minor is null
           or price_max_minor >= price_min_minor),

  /*
   * BACKSTOP ONE. A quote-only row may not carry a number, and a priced row must carry a currency.
   *
   * This mirrors the Phase 03 constraint on `products` so the two worlds fail the same way, and the
   * failure it prevents is arithmetic: a "price on request" row stored as `0` drags every average,
   * every band summary and every comparison in Phases 31–34 towards zero, and does it silently,
   * because zero is a number and nothing downstream can tell it from a real one.
   *
   * THE NORMALIZER NEVER OFFERS ONE. `price_quote_with_amount` catches it before the write and
   * stores the quote state with both amounts null and an ERROR attached; this fires for a
   * hand-written UPDATE and for nothing else.
   */
  add constraint research_price_state_coherent check (
    price_state is null
    or (price_state in ('FIXED', 'STARTING_FROM')
        and price_min_minor is not null and price_min_minor > 0 and currency is not null)
    or (price_state in ('REQUEST_QUOTE', 'PRICE_ON_REQUEST', 'UNKNOWN')
        and price_min_minor is null and price_max_minor is null)
  ),

  /*
   * BACKSTOP TWO, AND THE ONE WHERE THE DISTINCTION MATTERS MOST.
   *
   * `impossible_dimension` — any axis under 10 mm or over 10 000 mm — is an ERROR the normalizer
   * raises, and if this constraint were the enforcement point the normalizer's own write would
   * fail: it would have to either drop the row or refuse to record the issue. So it does neither.
   * It writes `dimensions_mm = null`, sets `dimension_parse_state = 'UNPARSED'`, keeps the source
   * string in the version's `raw` where it survives untouched, and attaches the ERROR — and the
   * row stays at `VALIDATED`, visible in the explorer's Issues view, counted on the dashboard.
   *
   * Nothing is lost by refusing to store a value the row is not allowed to hold, because the
   * evidence is stored somewhere else and always was.
   */
  add constraint research_dimensions_sane check (public.is_sane_research_dimensions(dimensions_mm));

comment on column research_products.matched_category_id is
  'Rivya taxonomy, reached through a staff-authored research_source_category_map row or a keyword rule a person can see and correct. The SECOND AND FINAL research → public foreign key (amendment A26); the isolation guard allowlists exactly two constraints by name and fails on a third. It points at taxonomy, never at products, and on delete set null so removing a category unmatches rather than deletes.';
comment on column research_products.normalized_overrides is
  'The keys a person has corrected by hand. renormalize.ts re-derives everything else from stored evidence and skips these, reporting the count — because a background job that silently undid a researcher''s correction would be a job nobody could trust twice.';
comment on column research_products.price_state is
  'FIXED · STARTING_FROM · REQUEST_QUOTE · PRICE_ON_REQUEST · UNKNOWN. The first four mirror the first-party vocabulary on `products` so a comparison never begins with a translation; UNKNOWN is this table''s alone, because a page Rivya could not read has no decided posture.';
comment on constraint research_price_state_coherent on research_products is
  'A BACKSTOP, not the enforcement point. The normalizer refuses a quote state carrying an amount before the write and stores the row flagged instead. This fires for a hand-written UPDATE.';
comment on constraint research_dimensions_sane on research_products is
  'A BACKSTOP, not the enforcement point. impossible_dimension nulls dimensions_mm and attaches an ERROR before the write, so the normalizer never offers a value this refuses.';

create index research_products_matched_category_idx
  on research_products (matched_category_id) where matched_category_id is not null;
create index research_products_price_idx
  on research_products (currency, price_state, price_min_minor)
  where price_min_minor is not null;
create index research_products_duplicate_idx
  on research_products (duplicate_of_id) where duplicate_of_id is not null;
-- Phase 28's duplicate check and Phase 29's title materiality both compare normalised titles.
create index research_products_title_trgm_idx
  on research_products using gin (title_normalized gin_trgm_ops);

-- --- 2. What is wrong with a row, and who said so ------------------------------------------------

create table research_validation_issues (
  id                  uuid primary key default gen_random_uuid(),
  research_product_id uuid not null references research_products (id) on delete cascade,

  -- The version the issue was found against. Null for an issue raised outside a version — none is
  -- today, and the column is nullable rather than the table being unable to record one later.
  version_id          uuid references research_product_versions (id) on delete set null,

  rule                text not null,
  severity            text not null,
  field               text,
  detail              text,

  /*
   * DISMISSED, NEVER DELETED, AND ALWAYS WITH A REASON. An issue that was wrong is a fact about the
   * rule that raised it, and deleting the row deletes the evidence that the rule needs changing.
   * `is_dismissed` also means the issue does not come back on the next run: `unique (product,
   * version, rule, field)` makes re-raising it an upsert onto the dismissed row rather than a
   * second row a person has to dismiss again.
   */
  is_dismissed        boolean not null default false,
  dismissed_by        uuid references auth.users (id),
  dismissed_at        timestamptz,
  dismiss_reason      text,

  detected_at         timestamptz not null default now(),

  constraint research_validation_issues_severity_allowlist
    check (severity in ('ERROR', 'WARNING', 'INFO')),
  -- A DISMISSAL NAMES SOMEBODY AND SAYS WHY. The same shape as the policy approval in `0231`: a
  -- decision with nobody's name against it is exactly the record that would be useless in the
  -- conversation it exists for.
  constraint research_validation_issues_dismissal_is_attributed
    check (is_dismissed = false
           or (dismissed_by is not null and dismissed_at is not null
               and dismiss_reason is not null and btrim(dismiss_reason) <> '')),
  constraint research_validation_issues_unique
    unique (research_product_id, version_id, rule, field)
);

comment on table research_validation_issues is
  'One finding per (product, version, rule, field). Raised by lib/scraper/validation/rules.ts before the write, never by a session — an ERROR is what stops a row being promoted, so a forged one is a way to hold rows back silently. A person DISMISSES one, with a reason, and the row is kept.';

create index research_validation_issues_triage_idx
  on research_validation_issues (severity, is_dismissed, detected_at desc);
create index research_validation_issues_by_product_idx
  on research_validation_issues (research_product_id);
-- The data-quality tab counts by rule.
create index research_validation_issues_by_rule_idx
  on research_validation_issues (rule) where is_dismissed = false;

-- --- 3. Two rows that might be one, for a person to decide -----------------------------------------

create table research_match_candidates (
  id                  uuid primary key default gen_random_uuid(),
  research_product_id uuid not null references research_products (id) on delete cascade,
  candidate_id        uuid not null references research_products (id) on delete cascade,

  method              text not null,
  score               numeric(4,3) not null,
  evidence            jsonb not null default '{}'::jsonb,

  decided             text not null default 'PENDING',
  decided_by          uuid references auth.users (id),
  decided_at          timestamptz,

  created_at          timestamptz not null default now(),

  constraint research_match_candidates_decided_allowlist
    check (decided in ('PENDING', 'ACCEPTED', 'REJECTED')),
  constraint research_match_candidates_method_allowlist
    check (method in ('EXTERNAL_ID', 'TITLE_PRICE', 'TRIGRAM_DIMENSION')),
  constraint research_match_candidates_score_range
    check (score >= 0 and score <= 1),
  constraint research_match_candidates_evidence_is_object
    check (jsonb_typeof(evidence) = 'object'),
  constraint research_match_candidates_is_another_row
    check (research_product_id <> candidate_id),
  -- A DECISION NAMES SOMEBODY. Accepting a candidate writes `duplicate_of_id` and `disposition`,
  -- which is a merchandiser's act; a decided row with nobody against it could not be questioned.
  constraint research_match_candidates_decision_is_attributed
    check (decided = 'PENDING' or (decided_by is not null and decided_at is not null)),
  constraint research_match_candidates_unique
    unique (research_product_id, candidate_id, method)
);

comment on table research_match_candidates is
  'A PROPOSAL, never a verdict. Auto-merge happens only at confidence ≥ 0.95 with title AND dimension agreement; everything below becomes a row here for a merchandiser to decide, because merging two genuinely different products is a mistake that hides one of them for good.';

create index research_match_candidates_pending_idx
  on research_match_candidates (decided, score desc) where decided = 'PENDING';
create index research_match_candidates_by_product_idx
  on research_match_candidates (research_product_id);

-- --- 4. The material vocabulary, as data ------------------------------------------------------------

create or replace function public.has_no_blank_pattern(value text[]) returns boolean
  language sql immutable set search_path = pg_catalog, public
  as $$
  select value is null or not exists (select 1 from unnest(value) as p(entry) where btrim(p.entry) = '')
$$;

comment on function public.has_no_blank_pattern(text[]) is
  'True when no element of the array is empty or whitespace. Exists because a CHECK constraint may not contain a subquery and walking an array needs one — the same reason is_sane_research_dimensions exists. A blank material pattern would match at almost any word boundary and tag every scraped product with that material.';

revoke execute on function public.has_no_blank_pattern(text[]) from public, anon;
grant execute on function public.has_no_blank_pattern(text[]) to authenticated, service_role;

create table research_material_lexicon (
  id          uuid primary key default gen_random_uuid(),

  -- The canonical token a matched material becomes: `oak`, `epoxy_resin`, `brass`.
  token       citext not null unique,
  -- The words a source might use for it. Matched case- and whitespace-insensitively as WHOLE WORDS,
  -- so `ash` does not match `ashtray` — the normalizer owns that rule; this column is its input.
  patterns    text[] not null,
  family      text,
  is_enabled  boolean not null default true,

  status      content_status not null default 'DRAFT',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id),

  constraint research_material_lexicon_token_shape
    check (token ~ '^[a-z][a-z0-9_]*$'),
  /*
   * `cardinality` AND NOT `array_length`, AND THE DIFFERENCE IS A REAL DEFECT THIS CONSTRAINT HAD.
   *
   * `array_length('{}'::text[], 1)` is NULL, not 0 — an empty array has no first dimension — and a
   * CHECK that evaluates to NULL PASSES. So `array_length(patterns, 1) >= 1` admitted exactly the
   * row it was written to refuse: a lexicon term with no patterns at all, which matches nothing
   * while looking perfectly configured in the Studio editor. Found by
   * `tests/unit/rls/phase28.test.ts` asserting the refusal rather than assuming it.
   * `cardinality` returns 0 for an empty array and needs no coalesce to say what it means.
   */
  constraint research_material_lexicon_has_patterns
    check (cardinality(patterns) >= 1),

  /*
   * AND NO PATTERN MAY BE BLANK, for a hazard of the same family. `matchMaterials` builds a
   * word-boundary expression from each pattern, and an empty one becomes a boundary assertion with
   * nothing between the two look-arounds — which matches in almost any text, so a single blank
   * pattern would tag every scraped product in the system with that material.
   * `prepareLexicon` already drops them; this is the row refusing to hold one at all.
   *
   * THROUGH A FUNCTION, for the reason given at length above `is_sane_research_dimensions`: walking
   * an array needs `unnest`, `unnest` in a CHECK is a subquery, and PostgreSQL refuses a subquery
   * in a CHECK outright. An IMMUTABLE function may hold what the constraint cannot.
   */
  constraint research_material_lexicon_patterns_are_words
    check (public.has_no_blank_pattern(patterns))
);

comment on table research_material_lexicon is
  'A parsing vocabulary for OTHER PEOPLE''S words — not a claim about what Rivya makes, and never rendered outside Studio. Data rather than code so that a material nobody anticipated is added in Studio and rolled out over stored versions by scripts/research/renormalize.ts, with no deploy and no network traffic.';
comment on column research_material_lexicon.patterns is
  'Whole-word patterns, lower case. The normalizer matches on word boundaries so that `ash` does not match `ashtray` and `oak` does not match `oakum`.';

create index research_material_lexicon_enabled_idx
  on research_material_lexicon (token) where is_enabled;

/*
 * THE SEED IS CONFIGURATION, NOT CONTENT, AND THE DISTINCTION IS THE ONE `db:check-migrations`
 * POLICES. A content row is something an owner writes and may edit — and a migration that recreates
 * it silently discards their edit on the next `db:reset`, which is why the seed runner exists. These
 * rows are neither: they are the starting vocabulary a PARSER needs in order to run at all, in the
 * same family as the change-rule defaults Phase 29 seeds and the scale rules Phase 30 seeds. An
 * owner editing one is editing configuration, and `updated_by` records that they did.
 *
 * NOTHING HERE IS A CLAIM ABOUT RIVYA. These are words to recognise on somebody else's page. The
 * list is deliberately materials a furniture catalogue anywhere might name, and it is deliberately
 * incomplete: an unmatched material is recorded as unmatched, which is the whole posture of this
 * phase, and the Studio editor is how the gap closes.
 */
-- check-migrations: allow-insert (the parsing vocabulary a normalizer needs to run at all, editable in Studio thereafter — configuration, not content)
insert into research_material_lexicon (token, patterns, family, status) values
  ('oak',          array['oak', 'white oak', 'red oak'],                    'wood',    'PUBLISHED'),
  ('walnut',       array['walnut', 'black walnut'],                          'wood',    'PUBLISHED'),
  ('ash',          array['ash', 'ash wood'],                                 'wood',    'PUBLISHED'),
  ('teak',         array['teak'],                                            'wood',    'PUBLISHED'),
  ('mango_wood',   array['mango wood', 'mangowood'],                         'wood',    'PUBLISHED'),
  ('sheesham',     array['sheesham', 'indian rosewood'],                     'wood',    'PUBLISHED'),
  ('rosewood',     array['rosewood'],                                        'wood',    'PUBLISHED'),
  ('maple',        array['maple'],                                           'wood',    'PUBLISHED'),
  ('birch',        array['birch', 'birch ply', 'birch plywood'],             'wood',    'PUBLISHED'),
  ('pine',         array['pine'],                                            'wood',    'PUBLISHED'),
  ('bamboo',       array['bamboo'],                                          'wood',    'PUBLISHED'),
  ('plywood',      array['plywood', 'ply'],                                  'wood',    'PUBLISHED'),
  ('mdf',          array['mdf', 'medium density fibreboard'],                'wood',    'PUBLISHED'),
  ('veneer',       array['veneer'],                                          'wood',    'PUBLISHED'),
  ('epoxy_resin',  array['epoxy', 'epoxy resin', 'resin'],                   'resin',   'PUBLISHED'),
  ('polyurethane', array['polyurethane', 'pu resin'],                        'resin',   'PUBLISHED'),
  ('acrylic',      array['acrylic', 'perspex'],                              'resin',   'PUBLISHED'),
  ('marble',       array['marble'],                                          'stone',   'PUBLISHED'),
  ('granite',      array['granite'],                                         'stone',   'PUBLISHED'),
  ('travertine',   array['travertine'],                                      'stone',   'PUBLISHED'),
  ('slate',        array['slate'],                                           'stone',   'PUBLISHED'),
  ('terrazzo',     array['terrazzo'],                                        'stone',   'PUBLISHED'),
  ('concrete',     array['concrete', 'cement'],                              'stone',   'PUBLISHED'),
  ('brass',        array['brass'],                                           'metal',   'PUBLISHED'),
  ('bronze',       array['bronze'],                                          'metal',   'PUBLISHED'),
  ('copper',       array['copper'],                                          'metal',   'PUBLISHED'),
  ('steel',        array['steel', 'mild steel'],                             'metal',   'PUBLISHED'),
  ('stainless_steel', array['stainless steel', 'stainless'],                 'metal',   'PUBLISHED'),
  ('iron',         array['iron', 'cast iron', 'wrought iron'],               'metal',   'PUBLISHED'),
  ('aluminium',    array['aluminium', 'aluminum'],                           'metal',   'PUBLISHED'),
  ('glass',        array['glass', 'tempered glass', 'toughened glass'],      'glass',   'PUBLISHED'),
  ('leather',      array['leather', 'full grain leather'],                   'textile', 'PUBLISHED'),
  ('linen',        array['linen'],                                           'textile', 'PUBLISHED'),
  ('cotton',       array['cotton'],                                          'textile', 'PUBLISHED'),
  ('velvet',       array['velvet'],                                          'textile', 'PUBLISHED'),
  ('wool',         array['wool', 'boucle', 'bouclé'],                        'textile', 'PUBLISHED'),
  ('rattan',       array['rattan', 'cane'],                                  'natural', 'PUBLISHED'),
  ('jute',         array['jute'],                                            'natural', 'PUBLISHED'),
  ('ceramic',      array['ceramic', 'stoneware', 'porcelain'],               'ceramic', 'PUBLISHED'),
  ('lacquer',      array['lacquer', 'lacquered'],                            'finish',  'PUBLISHED');

-- --- 5. The search document, rewritten for a product that now has a title ----------------------------
--
-- FEAT §18 LISTS *Scraped Products* AMONG THE TWELVE STUDIO SEARCH SCOPES, AND THIS IS THE FIRST
-- PHASE IN WHICH A RESEARCH ROW HAS A TITLE WORTH INDEXING. `0234` indexed one by its
-- `source_external_id` or its URL, which is what there was: a palette result would have been a bare
-- link with nothing to recognise it by, which is why Phase 25 registered no provider for it.
--
-- The trigger already exists (`research_products_search_sync`, `0234`) and is unchanged. What
-- changes is the branch this function takes for a `research_product`: the title is the normalised
-- one, the subtitle is the SOURCE'S NAME — because "which competitor is this" is the second thing
-- anybody wants — and the keywords are the material tokens and the category labels, which is how
-- somebody finds "the walnut dining tables" without knowing any of their titles.
--
-- NOTHING HERE BECOMES PUBLIC. `research_search_documents` has no `anon` policy (I2), and the public
-- `search_documents` cannot hold a research row at all: its `entity_type` allowlist does not admit
-- one, by a constraint Phase 23 wrote two phases before there was anything to index.
create or replace function public.refresh_research_search_document(p_entity_type text, p_entity_id uuid)
  returns void
  language plpgsql
  volatile
  security definer
  set search_path = public, extensions
as $fn$
declare
  v_title    text;
  v_subtitle text;
  v_body     text;
  v_status   text;
  v_url      text;
  v_source   text;
  v_keywords text[] := '{}';
  v_found    boolean := false;
begin
  if p_entity_type = 'research_source' then
    select true,
           s.name,
           s.base_url,
           concat_ws(' ', s.region, s.source_type::text, s.adapter_key, s.collection_mode::text),
           s.policy_status::text,
           '/studio/research/sources/' || s.id::text,
           s.base_url,
           array_remove(
             array[s.slug::text, s.region, s.source_type::text, s.collection_mode::text],
             null)
      into v_found, v_title, v_subtitle, v_body, v_status, v_url, v_source, v_keywords
      from research_sources s
     where s.id = p_entity_id;

  elsif p_entity_type = 'research_run' then
    select true,
           concat_ws(' — ', s.name, left(r.id::text, 8)),
           r.trigger::text,
           coalesce(r.error_summary, ''),
           r.status::text,
           '/studio/research/runs/' || r.id::text,
           null,
           array_remove(array[s.slug::text, r.status::text, r.trigger::text], null)
      into v_found, v_title, v_subtitle, v_body, v_status, v_url, v_source, v_keywords
      from research_runs r
      join research_sources s on s.id = r.source_id
     where r.id = p_entity_id;

  elsif p_entity_type = 'research_product' then
    /*
     * THE TITLE FALLS BACK THROUGH THREE THINGS AND NEVER TO NOTHING. The normalised title if the
     * row has reached NORMALIZED; otherwise the current version's raw title, which exists from the
     * moment an adapter read the page; otherwise the URL, which always exists. A row with no title
     * at all is deleted from the index by the guard below rather than indexed as an empty result.
     */
    select true,
           coalesce(
             nullif(btrim(p.title_normalized), ''),
             nullif(btrim(v.raw ->> 'title'), ''),
             nullif(btrim(p.source_external_id), ''),
             p.source_url),
           s.name,
           coalesce(nullif(btrim(p.brand_text), ''), ''),
           p.stage::text,
           '/studio/research/explorer?row=' || p.id::text,
           p.source_url,
           array_remove(
             array[s.slug::text, p.disposition::text, p.availability, p.currency::text]
               || coalesce(p.material_tokens, '{}')
               || coalesce(p.category_labels, '{}'),
             null)
      into v_found, v_title, v_subtitle, v_body, v_status, v_url, v_source, v_keywords
      from research_products p
      join research_sources s on s.id = p.source_id
      left join research_product_versions v on v.id = p.current_version_id
     where p.id = p_entity_id;

  else
    return;
  end if;

  if not coalesce(v_found, false) or v_title is null or btrim(v_title) = '' then
    delete from research_search_documents
     where entity_type = p_entity_type and entity_id = p_entity_id;
    return;
  end if;

  -- check-migrations: allow-insert (an index row derived from a source row inside a trigger function, not seeded content)
  insert into research_search_documents
    (entity_type, entity_id, visibility, status, url_path, title, subtitle, body, keywords,
     source_url, indexed_at)
  values
    (p_entity_type, p_entity_id, 'STAFF', v_status, v_url, v_title, v_subtitle, v_body,
     coalesce(v_keywords, '{}'::text[]), v_source, now())
  on conflict (entity_type, entity_id) do update
    set status     = excluded.status,
        url_path   = excluded.url_path,
        title      = excluded.title,
        subtitle   = excluded.subtitle,
        body       = excluded.body,
        keywords   = excluded.keywords,
        source_url = excluded.source_url,
        indexed_at = now();
end;
$fn$;

revoke execute on function public.refresh_research_search_document(text, uuid) from public, anon, authenticated;
grant execute on function public.refresh_research_search_document(text, uuid) to service_role;

/*
 * A NEW VERSION CHANGES A PRODUCT'S SEARCHABLE TITLE, AND UNTIL NOW NOTHING RE-INDEXED IT. The
 * function above reads `research_product_versions.raw ->> 'title'` through `current_version_id`, so
 * a row extracted for the first time gains a title that the product's own trigger — which fires on
 * `research_products` — has no reason to notice, because `extract.ts` writes the version BEFORE it
 * sets the pointer. Setting the pointer is an UPDATE on `research_products`, so the existing
 * trigger does fire; this one covers the other direction, where a later version replaces the raw
 * title under an unchanged pointer.
 */
create function public.tg_research_version_search() returns trigger
  language plpgsql volatile security definer set search_path = public, extensions
as $fn$
begin
  perform public.refresh_research_search_document('research_product', new.research_product_id);
  return new;
end;
$fn$;

create trigger research_product_versions_search_sync
  after insert or update on research_product_versions
  for each row execute function public.tg_research_version_search();

revoke execute on function public.tg_research_version_search() from public, anon, authenticated;

-- --- 6. RLS on, policies in 0261 ---------------------------------------------------------------------

alter table research_validation_issues enable row level security;
alter table research_match_candidates  enable row level security;
alter table research_material_lexicon  enable row level security;
