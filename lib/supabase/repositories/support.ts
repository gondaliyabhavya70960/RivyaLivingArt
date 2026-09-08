import type { PostgrestError } from '@supabase/supabase-js'
import type { z } from 'zod'

import { ConflictError, NotFoundError, PermissionError, ValidationError } from '../errors'

/**
 * Shared plumbing for every repository: turn a PostgREST result into either data or one of the
 * four typed errors, and validate that data against its schema before it leaves this layer.
 *
 * This file deliberately contains no `.from(` call of its own — it is the layer *below* the
 * queries, so `scripts/db/check-data-layer.mjs` has nothing to find here either way.
 */

/**
 * SQLSTATE codes worth distinguishing. Anything not listed falls through to a generic
 * ValidationError carrying the original, because inventing a category for an unfamiliar code is
 * worse than admitting we do not recognise it.
 */
const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'
const CHECK_VIOLATION = '23514'
const NOT_NULL_VIOLATION = '23502'
const INSUFFICIENT_PRIVILEGE = '42501'
/** PostgREST's own code for "`.single()` matched no rows". */
const NO_ROWS = 'PGRST116'

/** Pull the constraint name out of a PostgrestError. PostgREST puts it in `details` or `message`
 *  depending on the failure, so both are searched rather than assuming one shape. */
function constraintName(error: PostgrestError): string | null {
  const haystack = `${error.message} ${error.details ?? ''}`
  const match = haystack.match(/constraint "([^"]+)"/)
  return match?.[1] ?? null
}

/**
 * Map a PostgrestError onto the repository error vocabulary.
 *
 * `operation` and `entity` are used for the message only; they never change which error is thrown.
 */
export function toRepositoryError(
  entity: string,
  operation: string,
  identifier: string,
  error: PostgrestError,
): Error {
  switch (error.code) {
    case NO_ROWS:
      return new NotFoundError(entity, identifier, error)
    case UNIQUE_VIOLATION:
    case FOREIGN_KEY_VIOLATION:
      return new ConflictError(entity, constraintName(error), error)
    case INSUFFICIENT_PRIVILEGE:
      return new PermissionError(operation, entity, error)
    case CHECK_VIOLATION:
    case NOT_NULL_VIOLATION:
      return new ValidationError(
        entity,
        [{ path: constraintName(error) ?? '(unknown)', message: error.message }],
        error,
      )
    default:
      return new ValidationError(entity, [{ path: '(database)', message: error.message }], error)
  }
}

/** Parse one row, converting a Zod failure into a ValidationError that names the fields. */
export function parseRow<T>(entity: string, schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new ValidationError(
      entity,
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
      result.error,
    )
  }
  return result.data
}

/**
 * Parse a list.
 *
 * One bad row fails the whole call rather than being filtered out. Silently dropping it would
 * give a category listing that is quietly missing an item, with nothing anywhere saying why —
 * the hardest class of bug to notice and the easiest to prevent.
 */
export function parseRows<T>(entity: string, schema: z.ZodType<T>, data: unknown[]): T[] {
  return data.map((row, index) => {
    try {
      return parseRow(entity, schema, row)
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ValidationError(
          entity,
          error.issues.map((issue) => ({ ...issue, path: `[${index}].${issue.path}` })),
          error,
        )
      }
      throw error
    }
  })
}
