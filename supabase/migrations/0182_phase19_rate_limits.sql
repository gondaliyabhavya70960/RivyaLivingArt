-- ============================================================================================
-- 0182 — `rate_limit_buckets`, because a public endpoint cannot wait for Phase 41
--
-- WHY THIS IS HERE AND NOT IN PHASE 41, WHERE SECURITY.md PUTS IT. `app/api/media/sign` deferred
-- its own rate limit to Phase 41 and said so in a comment, and that was defensible: the route
-- demands a staff session with `media.write`, so the exposure is a signed-in colleague or a stolen
-- session. Phase 19 adds `app/api/inquiries/upload-sign`, which is UNAUTHENTICATED BY DESIGN — a
-- visitor filling in a bespoke brief has no account and D1 forbids giving them one.
--
-- An unauthenticated endpoint that mints upload credentials with no limit is an open file host with
-- Rivya's Cloudinary bill attached. The phase document names that risk outright and lists the
-- per-IP limit among its mitigations. Deferring it would mean shipping the risk and the note that
-- the mitigation exists somewhere in a phase twenty-two ahead.
--
-- SO THE TABLE ARRIVES EARLY AND PHASE 41 INHERITS IT. Its shape is the one DATA_MODEL already
-- specifies — `(bucket_key, window_start)` — so Phase 41 adds the staff-endpoint keys and the
-- sweeper rather than creating anything. Recorded as amendment A18.
--
-- A FIXED WINDOW, NOT A SLIDING ONE, and the trade is deliberate. A fixed window admits up to twice
-- the limit across a boundary — ten signatures at 10:59 and ten more at 11:01. A sliding window
-- costs a row per request and a range scan to answer, which is a lot of machinery to buy a factor
-- of two on a limit whose purpose is to stop automated abuse rather than to meter a paying client.
-- Two windows are enforced together instead: 3 a minute catches the burst, 10 an hour catches the
-- grind, and passing both is harder than passing either.
--
-- THE KEY IS HASHED BEFORE IT ARRIVES. SECURITY.md forbids storing a raw visitor IP, and
-- `activity_events` says the same in its own comment. The caller passes
-- `sha256(salt || ip)`; this table never sees an address and could not reconstruct one.
-- ============================================================================================

set search_path = public, extensions;

create table rate_limit_buckets (
  bucket_key   text not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (bucket_key, window_start),

  constraint rate_limit_buckets_count_positive check (count >= 0),
  -- A key is a hash and a prefix, never an address. The pattern is not security on its own — the
  -- caller does the hashing — but it makes a raw IP written here by mistake fail loudly.
  constraint rate_limit_buckets_key_shape check (bucket_key ~ '^[a-z][a-z0-9_.:-]{2,120}$')
);

comment on table rate_limit_buckets is
  'Fixed-window request counters. bucket_key is a PREFIXED HASH — never a raw IP, never an email. Rows older than the longest window are disposable; Phase 41 adds the sweeper.';

-- The window is the leading column of the primary key's second position, so a sweep by age is a
-- range scan rather than a sequential one. Phase 41's cleanup job depends on it.
create index rate_limit_buckets_window_idx on rate_limit_buckets (window_start);

alter table rate_limit_buckets enable row level security;

/**
 * Count one request and say whether it is allowed.
 *
 * ONE STATEMENT, AND THAT IS THE WHOLE DESIGN. A read-then-write limiter is a race: two concurrent
 * requests both read nine, both decide they are the tenth, and both proceed. `insert ... on
 * conflict do update` with the increment inside it is atomic, so the returned count is this
 * request's own position in the window and nobody else's.
 *
 * IT COUNTS THE REFUSED REQUESTS TOO. An attacker at the ceiling keeps incrementing and keeps being
 * refused, so hammering the endpoint does not shorten the wait — which is the behaviour a limit is
 * for. It also means the count is a true request tally rather than a tally of successes.
 *
 * SECURITY DEFINER and granted to `service_role` alone. `anon` must never call this directly: the
 * key is derived from the caller's address, and an anonymous caller able to pass any key could
 * exhaust somebody else's window on their behalf.
 */
create or replace function public.consume_rate_limit(
  p_bucket_key text,
  p_window_seconds int,
  p_limit int
) returns boolean
  language plpgsql
  security definer
  set search_path = pg_catalog, public
  as $$
declare
  v_window timestamptz;
  v_count  int;
begin
  -- The window a request falls in, computed from the epoch so every server agrees without
  -- coordinating: floor(now / width) * width.
  v_window := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  -- check-migrations: allow-insert (a function body, not a seeded row — this counts a request)
  insert into rate_limit_buckets (bucket_key, window_start, count)
  values (p_bucket_key, v_window, 1)
  on conflict (bucket_key, window_start)
  do update set count = rate_limit_buckets.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end $$;

revoke execute on function public.consume_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, int, int) to service_role;

comment on function public.consume_rate_limit(text, int, int) is
  'Increments a fixed-window counter and returns whether this request is within the limit. One statement, so two concurrent callers cannot both be the last one under the ceiling.';
