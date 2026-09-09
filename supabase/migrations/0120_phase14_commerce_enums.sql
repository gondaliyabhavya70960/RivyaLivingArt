-- ============================================================================================
-- 0120 — the commerce vocabulary: three enums that make a claim sayable
--
-- Phase 14 makes the catalogue browsable, and a browsable catalogue states three things about a
-- piece that the database currently has no words for: what its price means, whether it exists yet,
-- and how many of it there are. Each of those is a claim a visitor will read as a fact, so each
-- one is an enum rather than free text. A `text` column would let "in stock", "In Stock", "ready"
-- and "READY" all be the same claim spelled four ways, and a filter that has to guess which
-- spelling an editor typed is a filter that quietly drops rows.
--
-- WHY `FIXED` IS NEW. Phase 03 seeded `price_state` with three members, all of which mean "there
-- is no number here": STARTING_FROM carries a floor, REQUEST_QUOTE and PRICE_ON_REQUEST carry
-- nothing. There was no way to say "this piece costs exactly this", because nothing in the site
-- displayed a price yet. The product card does, so the state exists now — and 0122 makes it the
-- only state that may carry `price_minor`.
--
-- WHY THIS FILE ADDS VALUES AND NOTHING ELSE. `alter type ... add value` may run inside a
-- transaction on PostgreSQL 12+, but the new label cannot be USED in that same transaction — a
-- check constraint mentioning 'FIXED' in this file would fail with "unsafe use of new value".
-- Splitting the enum change from the columns (0121) and the constraints (0122) is what makes the
-- three files apply cleanly in one run rather than needing a manual pause between them.
--
-- `if not exists` on the value, plain `create type` on the types: adding the same value twice is
-- harmless and this file may be re-read by an operator, but a second `availability_state` would
-- mean two phases invented the same name and that should fail loudly rather than merge silently.
-- ============================================================================================

alter type price_state add value if not exists 'FIXED';

-- READY_STOCK is a claim about inventory. Its label is seeded OWNER_VERIFICATION_REQUIRED in
-- `content/seed/commerce-labels.ts`, and `products_ready_stock_verified` in 0122 refuses to publish
-- a product asserting it until the owner has marked that product VERIFIED (D10: never fabricate a
-- business fact). Those are two separate guards on two different rows — the label and the claim —
-- and the second one is named here because an earlier draft of this comment described a gate that
-- did not exist anywhere.
create type availability_state as enum ('READY_STOCK', 'MADE_TO_ORDER');

-- ONE_OF_ONE and LIMITED_EDITION are scarcity claims; OPEN_EDITION is the absence of one. 0122
-- requires LIMITED_EDITION to state its size, because "limited" without a number is marketing.
create type edition_state as enum ('ONE_OF_ONE', 'LIMITED_EDITION', 'OPEN_EDITION');

comment on type availability_state is
  'Whether a piece exists now (READY_STOCK) or is made when ordered (MADE_TO_ORDER). READY_STOCK is an inventory claim and needs owner verification before it can be published.';

comment on type edition_state is
  'How many of a piece exist. LIMITED_EDITION must state products.edition_size; the other two must not.';
