-- ============================================================================================
-- 0122 — the guards that make the commerce vocabulary honest
--
-- Every rule here exists because the alternative is a sentence on the public site that nobody
-- wrote and nobody can defend. The database is the last place these can be enforced, and it is the
-- only place that catches a row inserted by a script, a future import, or a Studio form somebody
-- refactored without reading this file.
--
-- 1. PRICE COHERENCE. Phase 03's version of `products_price_state_coherent` predates `FIXED` and
--    therefore rejects every fixed-price product. It is replaced rather than extended, because a
--    second overlapping constraint would give two error messages for one mistake. The rule is
--    exhaustive by construction: exactly one branch can be true, so there is no combination of
--    state and columns that is merely "not covered".
--
--    The branch that matters most is the third. A REQUEST_QUOTE product cannot carry a number AT
--    ALL — not a zero, not a placeholder, not a currency with nothing beside it. The listing risk
--    this phase names is a quote-only piece rendering as "₹0" or "From —", and `presentPrice`
--    guards it in the application; this guards it where the value would have to come from.
--
-- 2. EDITION COHERENCE. The phase document requires that LIMITED_EDITION states its size. This
--    goes one step further in the same direction and the extra step is argued, not assumed:
--      * `edition_size > 0` — "limited edition of 0" is not a scarcity claim, it is a typo, and
--        the visitor reads it as inventory.
--      * `edition_size is null` for the other states — "One of One, edition of 12" is a
--        contradiction the card would render straight-faced. ONE_OF_ONE already says its size in
--        its name; storing a second, disagreeing number is how the two drift apart.
--
-- 3. VERIFIED BEFORE PUBLISH is ALREADY PRESENT on `products` from Phase 03 and is deliberately
--    NOT re-created here. The phase document lists it because it belongs to this rule set; the
--    schema already satisfies it. Adding a duplicate under the same name fails; adding one under a
--    different name gives the same mistake two names. Its text is:
--        status <> 'PUBLISHED' or owner_verification <> 'OWNER_VERIFICATION_REQUIRED'
--
--    THAT CONSTRAINT IS NOT THE READY_STOCK GATE, and an earlier draft of this file said it was.
--    It reads the product's own `owner_verification`, and NOTHING ties that column to
--    `availability_state`: a row could say READY_STOCK, say NOT_REQUIRED, and publish. READY_STOCK
--    is an inventory claim — "we have this, now" — which is exactly the "real business capability"
--    D10 says must be confirmed by the owner rather than asserted by a seed or a form default. So
--    the gate is written here, explicitly, and it demands VERIFIED rather than merely
--    not-OWNER_VERIFICATION_REQUIRED: NOT_REQUIRED is the honest value for copy nobody needs to
--    confirm, and stock is never that.
--
-- 4. CONCEPT MEDIA MAY NEVER ILLUSTRATE A PRODUCT. This is D6's asset priority and D10's rule
--    about fabricated facts meeting in one trigger. A Higgsfield concept render can legitimately
--    show what a material looks like or how a process works — it is honest as illustration. The
--    moment it sits on a product card it stops being illustration and becomes a photograph of an
--    object that does not exist. `products` has zero rows today, so the first product media row
--    anyone inserts is already covered.
--
--    It is a trigger rather than a check constraint because the fact it tests lives in another
--    table, and a check constraint may not read one.
--
--    THE GUARD COVERS THREE EDGES, NOT ONE. An earlier draft watched only `product_media`, which
--    left the column the public card actually renders — `products.hero_media_id` — completely
--    unguarded. That is not a theoretical gap: `products_update_staff` admits `merchandiser`, and
--    PostgREST is reachable with a session cookie, so a PATCH setting `hero_media_id` to a concept
--    render never touches the Server Action that validates it and puts the render straight onto the
--    card. `product-page-data.ts` filtering the picker and `validation.ts` refusing the id are the
--    application's copies of this rule; this file is the one that holds when neither runs.
--
--    The third edge is the invariant read backwards. Guarding both attachment points still lets an
--    asset become concept AFTER it is attached — `update media_assets set is_concept = true` was
--    unwatched — which reaches the same end state by the other door. Concept-ness is therefore
--    refused on any asset a product is currently using.
--
--    All three functions pin `search_path`. They are SECURITY INVOKER, so this is defence in depth
--    rather than a live hole: an unpinned function resolves `media_assets` and `products` through
--    the caller's `search_path`, and a caller who can put a table in `pg_temp` ahead of `public`
--    makes the lookup find nothing and the guard pass. PostgREST gives nobody that, but a psql
--    session and a future SECURITY DEFINER rewrite both do.
-- ============================================================================================

-- --- 1. price coherence ---------------------------------------------------------------------
alter table products drop constraint products_price_state_coherent;

alter table products add constraint products_price_state_coherent check (
     (price_state = 'FIXED'
        and price_minor is not null and price_minor > 0
        and currency is not null
        and price_from_minor is null)
  or (price_state = 'STARTING_FROM'
        and price_from_minor is not null and price_from_minor > 0
        and currency is not null
        and price_minor is null)
  or (price_state in ('REQUEST_QUOTE', 'PRICE_ON_REQUEST')
        and price_minor is null
        and price_from_minor is null
        and currency is null)
);

comment on constraint products_price_state_coherent on products is
  'A price state and its columns must agree. FIXED carries price_minor, STARTING_FROM carries price_from_minor, and the two quote states carry no number and no currency at all — not even zero.';

-- --- 2. edition coherence -------------------------------------------------------------------
alter table products add constraint products_edition_size_coherent check (
  case
    when edition_state = 'LIMITED_EDITION' then edition_size is not null and edition_size > 0
    else edition_size is null
  end
);

comment on constraint products_edition_size_coherent on products is
  'A limited edition must state a positive size; every other edition state must not carry one. "One of One, edition of 12" is a contradiction a product card would render straight-faced.';

-- --- 3. an unverified stock claim may not be published ---------------------------------------
alter table products add constraint products_ready_stock_verified check (
  availability_state is distinct from 'READY_STOCK'
  or status <> 'PUBLISHED'
  or owner_verification = 'VERIFIED'
);

comment on constraint products_ready_stock_verified on products is
  'A published product may only claim READY_STOCK once the owner has verified it. Stock is a business fact (D10), so NOT_REQUIRED is not enough here — only VERIFIED is.';

-- --- 4. concept media may never illustrate a product -----------------------------------------
create or replace function public.reject_concept_product_media() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
  as $$
begin
  if exists (
    select 1 from media_assets m
     where m.id = new.media_asset_id
       and m.is_concept
  ) then
    raise exception
      'concept media cannot be attached to a product (%)', new.media_asset_id
      using errcode = 'check_violation',
            hint = 'Concept renders may illustrate a material or a process, never a product (D6, D10). Use real Rivya media.';
  end if;
  return new;
end $$;

comment on function public.reject_concept_product_media() is
  'Refuses a product_media row whose asset is a concept render. Phase 14, D6 asset priority and D10.';

create trigger product_media_reject_concept
  before insert or update on product_media
  for each row execute function public.reject_concept_product_media();

-- The hero is the image the card renders, so it is the edge that matters most.
create or replace function public.reject_concept_product_hero() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
  as $$
begin
  if new.hero_media_id is not null and exists (
    select 1 from media_assets m
     where m.id = new.hero_media_id
       and m.is_concept
  ) then
    raise exception
      'concept media cannot be a product hero image (%)', new.hero_media_id
      using errcode = 'check_violation',
            hint = 'Concept renders may illustrate a material or a process, never a product (D6, D10). Use real Rivya media.';
  end if;
  return new;
end $$;

comment on function public.reject_concept_product_hero() is
  'Refuses a product whose hero image is a concept render — the column the public card renders. Phase 14, D6 and D10.';

create trigger products_reject_concept_hero
  before insert or update of hero_media_id on products
  for each row execute function public.reject_concept_product_hero();

-- The same invariant read from the asset's side: an attached asset may not become a concept.
create or replace function public.reject_concept_flag_on_used_asset() returns trigger
  language plpgsql
  set search_path = pg_catalog, public
  as $$
begin
  if new.is_concept and not old.is_concept then
    if exists (select 1 from product_media pm where pm.media_asset_id = new.id)
       or exists (select 1 from products p where p.hero_media_id = new.id) then
      raise exception
        'asset % is attached to a product and cannot be marked as a concept render', new.id
        using errcode = 'check_violation',
              hint = 'Detach it from every product first. A concept render may never illustrate a product (D6, D10).';
    end if;
  end if;
  return new;
end $$;

comment on function public.reject_concept_flag_on_used_asset() is
  'Refuses flagging an asset as a concept render while a product still uses it — the concept invariant read backwards. Phase 14, D6 and D10.';

create trigger media_assets_reject_concept_when_used
  before update of is_concept on media_assets
  for each row execute function public.reject_concept_flag_on_used_asset();
