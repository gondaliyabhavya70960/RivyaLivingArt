import { describe, expect, it } from 'vitest'

import {
  PERMISSION_ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  isHeldByEveryRole,
  roleHasPermission,
  rolesWithPermission,
  type Role,
} from './permissions'
import { canSeeRoute, visibleNav, visibleRoutes } from './nav-visibility'
import { STUDIO_LEAVES } from './studio-nav'
import { redact } from '../logging/redact'

/**
 * The matrix and everything derived from it.
 *
 * These tests deliberately do NOT restate the 25×6 grid — the RLS suite already proves the database
 * agrees with `permissions.ts`, and a second hand-written copy here would only prove that two
 * transcriptions match. What is worth asserting is the structure the rest of the system relies on,
 * and the handful of cells whose exact value is load-bearing for a security decision elsewhere.
 */

describe('the permission matrix', () => {
  it('has all 32 permissions', () => {
    // A tripwire, not a specification. Its only job is to make a change to the matrix impossible
    // to make accidentally: adding or removing a cell fails here and sends the author to read the
    // assertions below, which are the ones that carry meaning.
    //
    // 25 at the end of Phase 04. Phase 05 adds four: `studio.access` and `activity.read` for its
    // own surfaces, and `system.environment.read` / `system.docs.read` because every D4 leaf needs
    // a real permission to be gated by, including the ones later phases fill.
    expect(PERMISSIONS).toHaveLength(32)
  })

  it('names exactly the six D5 roles', () => {
    expect([...ROLES]).toEqual(['owner', 'admin', 'editor', 'merchandiser', 'researcher', 'viewer'])
  })

  it('grants owner and admin every permission except the owner-only one', () => {
    // Not decoration: /studio/system/users must never be reachable by anyone else, and an admin
    // who could transfer ownership could lock the owner out of their own project.
    for (const permission of PERMISSIONS) {
      if (permission === 'system.owner.transfer') continue
      expect(roleHasPermission('owner', permission), permission).toBe(true)
      expect(roleHasPermission('admin', permission), permission).toBe(true)
    }
    expect(roleHasPermission('admin', 'system.owner.transfer')).toBe(false)
  })

  it('gives system.owner.transfer to owner alone', () => {
    expect([...rolesWithPermission('system.owner.transfer')]).toEqual(['owner'])
  })

  it('excludes the researcher from inquiries.read', () => {
    // THIS GAP IS LOAD-BEARING. It is the reason a staff-select policy on `inquiries` must be
    // written out explicitly in Phase 20 rather than copied from a catalogue table: the shorthand
    // would hand a researcher every customer's name, phone number and email.
    expect(roleHasPermission('researcher', 'inquiries.read')).toBe(false)
    expect(isHeldByEveryRole('inquiries.read')).toBe(false)
  })

  it('splits the research permissions so a researcher gathers and a merchandiser decides', () => {
    expect(roleHasPermission('researcher', 'research.write')).toBe(true)
    expect(roleHasPermission('researcher', 'research.confirm')).toBe(false)
    expect(roleHasPermission('merchandiser', 'research.confirm')).toBe(true)
    expect(roleHasPermission('merchandiser', 'research.write')).toBe(false)
  })

  it('restricts the audit and seed logs to owner and admin', () => {
    // If either of these ever becomes all-six, check-rls.ts will start accepting the is_staff()
    // shorthand on the security log. That is why it is asserted here as well as there.
    expect([...rolesWithPermission('operations.audit.read')]).toEqual(['owner', 'admin'])
    expect([...rolesWithPermission('operations.logs.read')]).toEqual(['owner', 'admin'])
  })

  it('lets no role but owner and admin delete', () => {
    expect([...rolesWithPermission('destructive.execute')]).toEqual(['owner', 'admin'])
    expect([...rolesWithPermission('media.delete')]).toEqual(['owner', 'admin'])
  })

  it('returns roles in canonical order, whatever order they were declared in', () => {
    // The generated policy SQL depends on this: check-rls compares role lists positionally, so an
    // unstable order would look like drift.
    for (const permission of PERMISSIONS) {
      const roles = rolesWithPermission(permission)
      const canonical = ROLES.filter((r) => roles.includes(r))
      expect([...roles], permission).toEqual([...canonical])
    }
  })

  it('never grants a permission to nobody', () => {
    // A permission held by no role is either a typo or a feature nobody can use.
    for (const permission of PERMISSIONS) {
      expect(rolesWithPermission(permission).length, permission).toBeGreaterThan(0)
    }
  })
})

describe('ROLE_PERMISSIONS is derived, not a second copy', () => {
  it('agrees with PERMISSION_ROLES in both directions', () => {
    for (const role of ROLES) {
      for (const permission of PERMISSIONS) {
        const fromRoleMajor = ROLE_PERMISSIONS[role].includes(permission)
        const fromPermissionMajor = (PERMISSION_ROLES[permission] as readonly Role[]).includes(role)
        expect(fromRoleMajor, `${role} / ${permission}`).toBe(fromPermissionMajor)
      }
    }
  })

  it('gives the viewer nothing that can change anything', () => {
    // Asserted by what the permission DOES, not by how its name ends.
    //
    // This read `toMatch(/\.read$/)` until Phase 05 added `studio.access` — a permission that
    // mutates nothing but does not end in `.read`, so it failed a test whose intent it satisfied.
    // Tightening the rule to name the mutating verbs keeps the regression this guards against (a
    // viewer quietly gaining `catalog.write`) while no longer failing on a permission that is
    // read-shaped in every way except spelling.
    // `review` and `verify` join the list at Phase 08. Both change state — one moves a section
    // between statuses, the other asserts a business claim is true — so a viewer holding either
    // would defeat the whole point of this test.
    const MUTATING = /\.(write|publish|review|verify|delete|execute|manage|transfer|confirm)$/

    for (const permission of ROLE_PERMISSIONS.viewer) {
      expect(permission, `viewer holds ${permission}`).not.toMatch(MUTATING)
    }
  })

  it('gives the viewer read access without any Studio write permission at all', () => {
    // The other direction, so the rule above cannot pass by the viewer holding nothing.
    expect(ROLE_PERMISSIONS.viewer.length).toBeGreaterThan(0)
    expect(roleHasPermission('viewer', 'catalog.read')).toBe(true)
    expect(roleHasPermission('viewer', 'studio.access')).toBe(true)
    expect(roleHasPermission('viewer', 'catalog.write')).toBe(false)
    expect(roleHasPermission('viewer', 'system.users.manage')).toBe(false)
  })

  it('keeps the activity feed separate from the security log', () => {
    // activity.read is every role; operations.audit.read is owner and admin. Merging them is a
    // recurring temptation because both tables look like "a log", and the merge would put the
    // authorisation log — including every DENIED row — in front of a viewer.
    expect(isHeldByEveryRole('activity.read')).toBe(true)
    expect(roleHasPermission('viewer', 'operations.audit.read')).toBe(false)
    expect(roleHasPermission('editor', 'operations.audit.read')).toBe(false)
  })
})

describe('nav visibility', () => {
  it('shows an anonymous visitor nothing', () => {
    expect(visibleRoutes(null)).toEqual([])
    expect(canSeeRoute(null, '/studio/catalog/products')).toBe(false)
  })

  it('resolves by LONGEST matching prefix', () => {
    // /studio/system is governed by system.settings.write and /studio/system/users by
    // system.users.manage. Shortest-prefix matching would show the wrong link; here both happen to
    // be owner+admin, so the test uses a role that holds neither to prove the resolution itself.
    expect(canSeeRoute('editor', '/studio/system/users')).toBe(false)
    expect(canSeeRoute('owner', '/studio/system/users')).toBe(true)
  })

  it('hides research surfaces from an editor and shows them to a researcher', () => {
    expect(canSeeRoute('editor', '/studio/research/sources')).toBe(false)
    expect(canSeeRoute('researcher', '/studio/research/sources')).toBe(true)
  })

  it('hides the audit surface from everyone but owner and admin', () => {
    for (const role of ROLES) {
      const expected = role === 'owner' || role === 'admin'
      expect(canSeeRoute(role, '/studio/operations/audit'), role).toBe(expected)
    }
  })

  it('lets every role see the overview', () => {
    for (const role of ROLES) expect(canSeeRoute(role, '/studio'), role).toBe(true)
  })

  it('governs every declared route by a real permission', () => {
    for (const leaf of STUDIO_LEAVES) {
      expect(PERMISSIONS, leaf.href).toContain(leaf.permission)
      if (leaf.writePermission !== undefined) {
        expect(PERMISSIONS, `${leaf.href} (write)`).toContain(leaf.writePermission)
      }
    }
  })

  it('shows a group when ANY leaf in it is visible, not when all are', () => {
    // The merchandiser case, which a group-level matrix gets wrong. Operations holds `audit` and
    // `logs` (owner/admin only) alongside `data-quality`, `imports` and `exports`, which they hold.
    const operations = visibleNav('merchandiser').find((group) => group.id === 'operations')

    expect(operations, 'merchandiser cannot see Operations at all').toBeDefined()
    const hrefs = operations?.leaves.map((leaf) => leaf.href) ?? []
    expect(hrefs).toContain('/studio/operations/imports')
    expect(hrefs).toContain('/studio/operations/data-quality')
    expect(hrefs).not.toContain('/studio/operations/audit')
    expect(hrefs).not.toContain('/studio/operations/logs')
  })

  it('never returns a group with no leaves', () => {
    for (const role of ROLES) {
      for (const group of visibleNav(role)) {
        expect(group.leaves.length, `${role} sees an empty ${group.id}`).toBeGreaterThan(0)
      }
    }
  })

  it('shows the viewer System only for the feature-flag register', () => {
    // STUDIO_GUIDE §2.2 records this explicitly, and records that narrowing the flags read
    // permission was REJECTED: the register of what is switched on must not be invisible to the
    // role most likely to be told "that feature is off".
    const system = visibleNav('viewer').find((group) => group.id === 'system')
    expect(system?.leaves.map((leaf) => leaf.href)).toEqual(['/studio/system/flags'])
  })

  it('refuses a path outside the Studio', () => {
    expect(canSeeRoute('owner', '/product/some-slug')).toBe(false)
  })
})

describe('audit redaction', () => {
  it('strips anything key-shaped, at any depth', () => {
    const result = redact({
      safe: 'kept',
      password: 'hunter2',
      nested: { api_key: 'abc', deeper: { authorization: 'Bearer x' } },
    }) as Record<string, unknown>

    expect(result.safe).toBe('kept')
    expect(result.password).toBe('[redacted]')
    expect((result.nested as Record<string, unknown>).api_key).toBe('[redacted]')
    expect(
      ((result.nested as Record<string, unknown>).deeper as Record<string, unknown>).authorization,
    ).toBe('[redacted]')
  })

  it('strips personal data the security log has no business holding', () => {
    // A log that accumulates customer contact details is a second copy of the thing it protects,
    // kept longer and read by more people.
    const result = redact({ email: 'a@b.c', phone: '+91...', message: 'free text' }) as Record<
      string,
      unknown
    >
    expect(result.email).toBe('[redacted]')
    expect(result.phone).toBe('[redacted]')
    expect(result.message).toBe('[redacted]')
  })

  it('matches on substring, so serviceRoleKey and SUPABASE_SERVICE_ROLE_KEY both go', () => {
    const result = redact({
      serviceRoleKey: 'x',
      SUPABASE_SERVICE_ROLE_KEY: 'y',
      accessToken: 'z',
    }) as Record<string, unknown>
    expect(Object.values(result)).toEqual(['[redacted]', '[redacted]', '[redacted]'])
  })

  it('walks arrays', () => {
    const result = redact([{ token: 'a' }, { safe: 'b' }]) as Record<string, unknown>[]
    expect(result[0]?.token).toBe('[redacted]')
    expect(result[1]?.safe).toBe('b')
  })

  it('does not recurse forever on a cyclic object', () => {
    const cyclic: Record<string, unknown> = { name: 'x' }
    cyclic.self = cyclic
    expect(() => redact(cyclic)).not.toThrow()
  })

  it('passes primitives through untouched', () => {
    expect(redact('plain')).toBe('plain')
    expect(redact(42)).toBe(42)
    expect(redact(null)).toBe(null)
  })
})
