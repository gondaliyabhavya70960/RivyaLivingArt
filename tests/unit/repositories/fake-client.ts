import type { PostgrestError } from '@supabase/supabase-js'

/**
 * A stand-in for the Supabase query builder.
 *
 * WHAT THESE TESTS DO AND DO NOT COVER — stated plainly, because a fake that is mistaken for the
 * real thing is worse than no test at all.
 *
 * COVERED: that a repository queries the table it claims to, applies the filters and ordering it
 * claims to, maps each PostgREST error code onto the right typed error, and refuses a row that
 * fails its Zod schema.
 *
 * NOT COVERED: that the SQL PostgREST generates is correct, or that RLS behaves as intended. Those
 * need a real PostgREST, which this environment has no way to run. They are covered instead by the
 * migrations being applied to a real PostgreSQL cluster and asserted against directly — see
 * scripts/db/check-schema.mjs and the Phase 03 verification record.
 */

export type Call = { method: string; args: unknown[] }

export type FakeResult = {
  data: unknown
  error: PostgrestError | null
}

/** Build a PostgrestError with a given SQLSTATE, for the error-mapping tests. */
export function postgrestError(code: string, message = 'boom', details?: string): PostgrestError {
  return {
    code,
    message,
    details: details ?? '',
    hint: '',
    name: 'PostgrestError',
  } as PostgrestError
}

class FakeBuilder implements PromiseLike<FakeResult> {
  constructor(
    private readonly calls: Call[],
    private readonly result: FakeResult,
  ) {}

  private record(method: string, args: unknown[]): this {
    this.calls.push({ method, args })
    return this
  }

  select(...args: unknown[]) {
    return this.record('select', args)
  }
  eq(...args: unknown[]) {
    return this.record('eq', args)
  }
  is(...args: unknown[]) {
    return this.record('is', args)
  }
  ilike(...args: unknown[]) {
    return this.record('ilike', args)
  }
  order(...args: unknown[]) {
    return this.record('order', args)
  }
  limit(...args: unknown[]) {
    return this.record('limit', args)
  }
  insert(...args: unknown[]) {
    return this.record('insert', args)
  }
  update(...args: unknown[]) {
    return this.record('update', args)
  }

  /** Terminal: one row or null. */
  maybeSingle(): PromiseLike<FakeResult> {
    this.record('maybeSingle', [])
    return Promise.resolve(this.result)
  }

  /** Terminal: exactly one row. */
  single(): PromiseLike<FakeResult> {
    this.record('single', [])
    return Promise.resolve(this.result)
  }

  /** A list query awaits the builder itself, so it has to be thenable. */
  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}

export type FakeClient = {
  calls: Call[]
  /** The table name passed to `.from()`, so a test can assert the repository queried the right one. */
  table: string | null
  // Deliberately loosely typed: the repositories take a fully typed SupabaseClient, and the point
  // of the cast at each call site is that these tests exercise runtime behaviour, not the types.
  client: never
}

export function makeFakeClient(result: FakeResult): FakeClient {
  const calls: Call[] = []
  const state: { table: string | null } = { table: null }

  const client = {
    from(table: string) {
      state.table = table
      calls.push({ method: 'from', args: [table] })
      return new FakeBuilder(calls, result)
    },
  }

  return {
    calls,
    get table() {
      return state.table
    },
    client: client as never,
  }
}

/** Convenience: find the arguments of the first call to a method. */
export function argsOf(calls: Call[], method: string): unknown[] | undefined {
  return calls.find((call) => call.method === method)?.args
}

/** Convenience: every call to a method. */
export function allArgsOf(calls: Call[], method: string): unknown[][] {
  return calls.filter((call) => call.method === method).map((call) => call.args)
}
