import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { PERMISSION_ROLES } from '@/lib/auth/permissions'

/**
 * WHO MAY CLEAR THE OWNER'S FLAG — the D10 mechanism, pinned.
 *
 * `owner_verification` is the column CLAUDE.md's "never fabricate business facts" rule rests on:
 * copy that asserts a real business capability is seeded OWNER_VERIFICATION_REQUIRED and stays out
 * of the public site until the owner confirms it. Twenty sections across nine pages sit behind it
 * today.
 *
 * IT WAS BYPASSABLE BY A SELECT. `updateSectionAction` takes `content.write` — owner, admin AND
 * editor — and wrote `owner_verification` straight through from the form. The database does not
 * catch it: `enforce_verification_authority` raises only on VERIFIED, and the publish gate accepts
 * NOT_REQUIRED just as readily. So an editor could move a section out of the owner's gate and
 * publish it alone. `tests/unit/rls/phase08.test.ts` pins that database behaviour; this pins the
 * application's, which is the layer that actually refuses.
 *
 * IT READS THE SOURCE because the alternative is standing up an authenticated Server Action
 * against a live session, and the invariant worth protecting is a static one: this column is not
 * in that action's write. A future edit that re-adds it fails here.
 */

const ROOT = join(import.meta.dirname, '..', '..')
const ACTIONS = readFileSync(join(ROOT, 'app/(studio)/studio/(shell)/content/actions.ts'), 'utf8')

/**
 * The body of one exported action, from its signature to whatever is declared next.
 *
 * STOPPING AT THE NEXT `export` ALONE IS NOT ENOUGH — the const a later action parses its input
 * with sits between the two, so the slice would swallow it and the following action's doc comment
 * with it. The first of `export`, `const` and a section banner is the real end.
 */
function actionBody(name: string): string {
  const start = ACTIONS.indexOf(`export async function ${name}(`)
  expect(start, `${name} is not exported from the content actions`).toBeGreaterThan(-1)
  const ends = ['\nexport ', '\nconst ', '\n// ---']
    .map((token) => ACTIONS.indexOf(token, start + 1))
    .filter((index) => index !== -1)
  return ACTIONS.slice(start, ends.length === 0 ? undefined : Math.min(...ends))
}

describe('the owner-verification gate', () => {
  it('is not a permission an editor holds', () => {
    // If this ever widens, every assertion below stops meaning anything.
    expect(PERMISSION_ROLES['content.verify']).not.toContain('editor')
    expect(PERMISSION_ROLES['content.write']).toContain('editor')
    expect(PERMISSION_ROLES['content.publish']).toContain('editor')
  })

  it('is not written by the ordinary section edit', () => {
    const body = actionBody('updateSectionAction')
    expect(body).toContain("requirePermission('content.write')")
    expect(body).not.toMatch(/owner_verification\s*:/)
    expect(body).not.toMatch(/ownerVerification/)
  })

  it('moves only through an action that takes content.verify', () => {
    const body = actionBody('setSectionVerificationAction')
    expect(body).toContain("requirePermission('content.verify')")
    expect(body).toMatch(/owner_verification\s*:/)
  })

  it('offers no way back to NOT_REQUIRED', () => {
    /*
     * NOT_REQUIRED says "this copy asserts nothing needing confirmation" — a judgement made when
     * the section is written. Offering it on the verify action would rebuild the bypass one enum
     * value further along, since it satisfies the publish gate exactly as VERIFIED does.
     */
    const schema = ACTIONS.slice(
      ACTIONS.indexOf('const verificationSchema'),
      ACTIONS.indexOf('export async function setSectionVerificationAction'),
    )
    expect(schema).toContain('VERIFIED')
    expect(schema).toContain('OWNER_VERIFICATION_REQUIRED')
    expect(schema).not.toContain("'NOT_REQUIRED'")
  })
})
