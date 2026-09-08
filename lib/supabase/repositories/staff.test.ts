import { describe, expect, it } from 'vitest'

import { isLastOwnerRefusal, LAST_OWNER_CONSTRAINT } from './staff'
import { ConflictError, NotFoundError, ValidationError } from '../errors'

/**
 * The last-owner refusal predicate.
 *
 * The Studio uses this to turn one specific database refusal into an actionable sentence instead of
 * a 500. It is tested because it is the kind of predicate that stops matching silently: the failure
 * mode is not an error, it is a confusing error, shown at the exact moment someone is trying to
 * hand over ownership of the project.
 *
 * The refusal reaches the application through two shapes depending on whether PostgREST carries the
 * constraint identifier through, so both are covered.
 */
describe('isLastOwnerRefusal', () => {
  it('matches on the constraint identifier the trigger raises with', () => {
    const error = new ValidationError('staff profile', [
      { path: LAST_OWNER_CONSTRAINT, message: 'anything at all' },
    ])
    expect(isLastOwnerRefusal(error)).toBe(true)
  })

  it('falls back to the message when the identifier did not come through', () => {
    const error = new ValidationError('staff profile', [
      { path: '(unknown)', message: 'refusing to leave the project with no active owner' },
    ])
    expect(isLastOwnerRefusal(error)).toBe(true)
  })

  it('is case-insensitive about the message', () => {
    const error = new ValidationError('staff profile', [
      { path: '(unknown)', message: 'ERROR: Refusing to leave the project with NO ACTIVE OWNER' },
    ])
    expect(isLastOwnerRefusal(error)).toBe(true)
  })

  it('does NOT match a different check violation', () => {
    // The failure this guards against: reporting "the last owner cannot be demoted" when what
    // actually happened was an invalid status value.
    const error = new ValidationError('staff profile', [
      { path: 'staff_profiles_status_allowed', message: 'violates check constraint' },
    ])
    expect(isLastOwnerRefusal(error)).toBe(false)
  })

  it('does not match other repository errors', () => {
    expect(isLastOwnerRefusal(new ConflictError('staff profile', 'staff_profiles_email_key'))).toBe(
      false,
    )
    expect(isLastOwnerRefusal(new NotFoundError('staff profile', 'x'))).toBe(false)
  })

  it('does not match things that are not errors at all', () => {
    for (const value of [null, undefined, 'no active owner', { message: 'no active owner' }, 42]) {
      expect(isLastOwnerRefusal(value), String(value)).toBe(false)
    }
  })

  it('matches when one of several issues is the refusal', () => {
    const error = new ValidationError('staff profile', [
      { path: 'something_else', message: 'unrelated' },
      { path: LAST_OWNER_CONSTRAINT, message: 'refused' },
    ])
    expect(isLastOwnerRefusal(error)).toBe(true)
  })
})
