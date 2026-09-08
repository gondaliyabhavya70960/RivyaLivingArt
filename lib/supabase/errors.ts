/**
 * The error vocabulary every repository throws.
 *
 * Repositories never leak a PostgrestError to a caller. A caller that has to inspect
 * `error.code === '23505'` to find out it hit a unique violation is coupled to PostgREST's wire
 * format, and a Server Action that catches such an error has no safe way to decide what to tell
 * the user. These four classes are the whole contract instead.
 *
 * Each carries the machine-readable facts a caller needs to build a message — never a
 * user-facing sentence. Copy lives in the CMS (`global_content`), not in a thrown error.
 */

/** Base class, so a caller can `catch (e) { if (e instanceof RepositoryError) ... }`. */
export abstract class RepositoryError extends Error {
  abstract readonly kind: 'not_found' | 'conflict' | 'validation' | 'permission'

  constructor(
    message: string,
    /**
     * The underlying error, kept for logging. Never rendered.
     *
     * `override` because Error already declares `cause`. Narrowing it here would be a lie — the
     * cause really can be anything a driver throws — so it keeps `unknown` and callers narrow it.
     */
    override readonly cause?: unknown,
  ) {
    super(message)
    this.name = new.target.name
  }
}

/** The row does not exist, or is not visible to this caller. The two are deliberately the same
 *  error: telling an anonymous visitor that a draft product exists but is not for them is an
 *  information leak, and RLS gives us no way to distinguish them anyway. */
export class NotFoundError extends RepositoryError {
  readonly kind = 'not_found' as const

  constructor(
    readonly entity: string,
    readonly identifier: string,
    cause?: unknown,
  ) {
    super(`${entity} not found: ${identifier}`, cause)
  }
}

/** A uniqueness or foreign-key rule refused the write — a duplicate slug, a category that still
 *  has products in it. `constraint` is the database constraint name, which is how a caller maps
 *  the failure onto the field that caused it. */
export class ConflictError extends RepositoryError {
  readonly kind = 'conflict' as const

  constructor(
    readonly entity: string,
    readonly constraint: string | null,
    cause?: unknown,
  ) {
    super(`${entity} conflicts with an existing row${constraint ? ` (${constraint})` : ''}`, cause)
  }
}

/**
 * The data did not match its schema.
 *
 * This is thrown on READS as well as writes, and that is the point. A row that fails its Zod
 * schema on the way out means the database holds something the application's model says is
 * impossible — a drifted migration, a hand-edited row, a column that changed type. Returning it
 * anyway would push the failure into a component, where it would surface as a blank page. Failing
 * here names the table and the field.
 */
export class ValidationError extends RepositoryError {
  readonly kind = 'validation' as const

  constructor(
    readonly entity: string,
    /** Field path -> what was wrong with it. */
    readonly issues: readonly { path: string; message: string }[],
    cause?: unknown,
  ) {
    super(
      `${entity} failed validation: ${issues.map((i) => `${i.path || '(root)'}: ${i.message}`).join('; ')}`,
      cause,
    )
  }
}

/** RLS or a server-side permission check refused the operation. Never thrown to distinguish
 *  "forbidden" from "does not exist" on a read — see NotFoundError. */
export class PermissionError extends RepositoryError {
  readonly kind = 'permission' as const

  constructor(
    readonly operation: string,
    readonly entity: string,
    cause?: unknown,
  ) {
    super(`not permitted: ${operation} on ${entity}`, cause)
  }
}
