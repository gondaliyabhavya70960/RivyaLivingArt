-- ============================================================================================
-- 0121 — the columns a product card reads, and the two indexes a listing needs
--
-- Everything here is nullable except `is_customizable`, and that asymmetry is deliberate. A
-- product is entered by an owner over several sittings (SEED §32: products come from owner entry,
-- never from a seed), so every claim starts as "not stated yet" and becomes a value when someone
-- states it. `null` is the honest representation of "nobody has said": a `not null default` on
-- `availability_state` would mean every product Rivya has ever half-typed silently asserts an
-- availability it was never given.
--
-- `is_customizable` is the exception because its two values are "we will customise this" and "we
-- will not", and the second is the safe default — an unset flag must never read as an offer.
--
-- `price_minor` IS AN INTEGER OF THE SMALLEST UNIT, not a decimal, matching `price_from_minor`
-- from Phase 03: ₹12,500 is 1250000. Money in a float is money that rounds, and money in `numeric`
-- invites a locale-formatted string somewhere downstream. `lib/catalog/price.ts` is the only place
-- the integer becomes words.
--
-- `sort_order` IS THE CURATION HANDLE. The default listing order is "curated": `sort_order` first,
-- nulls last, then newest published. Null therefore means "unplaced, fall in behind the placed
-- ones" rather than "position zero", which is why it has no default.
--
-- ============================================================================================
-- THE TWO INDEXES
--
-- `products_listing_idx` and `products_facets_idx` ALREADY EXIST. 0008 created both in their
-- Phase 03 form and wrote the instruction this file is carrying out: they name Phase 14 columns,
-- so they were created without them and must be DROPPED AND RECREATED here rather than added to.
-- An index cannot gain a column in place, and leaving the short version beside a new long one
-- would keep a redundant index write-amplifying every product update forever.
--
-- `products_listing_idx` serves the category page's default query: one category, published only,
-- ordered by the curation handle then recency. Its column order is the query's: equality columns
-- first (`category_id`, `status`), then the ordering columns in the exact direction the listing
-- asks for them, so PostgreSQL can walk the index instead of sorting the category. `sort_order
-- nulls last` matches the ORDER BY exactly; written any other way the planner sorts anyway.
--
-- `products_facets_idx` serves the filter rail. Facet counts are computed from the same predicate
-- as the rows (a facet counted from a different query is a facet that lies), so the index leads
-- with `status` and then carries the four dimensions the rail offers.
--
-- `product_materials_material_idx` is NOT created here. 0008 already created it on
-- `(material_id, product_id)` — the direction the material facet reads the join from — so the
-- phase document's third index is a description of what the schema has, not a change to make.
-- ============================================================================================

alter table products
  add column price_minor         bigint,
  add column availability_state  availability_state,
  add column edition_state       edition_state,
  add column edition_size        integer,
  add column is_customizable     boolean not null default false,
  add column sort_order          integer;

comment on column products.price_minor is
  'Exact price in the smallest unit of products.currency. Only price_state = FIXED may carry it (0122).';
comment on column products.availability_state is
  'READY_STOCK or MADE_TO_ORDER. Null means the owner has not stated it; the card then shows no availability badge.';
comment on column products.edition_state is
  'ONE_OF_ONE, LIMITED_EDITION or OPEN_EDITION. LIMITED_EDITION must also set edition_size (0122).';
comment on column products.edition_size is
  'How many exist in a limited edition. Meaningless for the other two states, and 0122 refuses it there.';
comment on column products.is_customizable is
  'Whether this piece can be customised. Defaults false: an unset flag must never read as an offer.';
comment on column products.sort_order is
  'Curation handle for the default listing order. Null sorts last — unplaced, not first.';

-- The trailing `nulls last` and `id` are not decoration; they are what lets this index ORDER the
-- listing instead of merely filtering it. PostgreSQL's `desc` means DESC NULLS FIRST, and the
-- curated sort asks for `published_at desc nulls last` (an unpublished draft sorts last, not
-- first), so an index storing NULLS FIRST cannot supply that order. Measured on 5 000 synthetic
-- rows: without them the plan is an Incremental Sort with `Presorted Key: sort_order`, re-sorting
-- every group by published_at and id; with them it is a bare Index Only Scan and no sort node at
-- all. `id` is included because every sort in `catalog-listing.ts` ends with it to make the order
-- total, and a sort key the index omits forces the sort back.
drop index products_listing_idx;
create index products_listing_idx
  on products (category_id, status, sort_order nulls last, published_at desc nulls last, id);

drop index products_facets_idx;
create index products_facets_idx
  on products (status, is_large_format, price_state, availability_state, edition_state);
