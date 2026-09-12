import { describe, expect, it } from 'vitest'

import { BOOTSTRAP_VARIABLES, DEFAULT_BOOTSTRAP_ROLE, readBootstrapConfig } from './bootstrap'

/**
 * The bootstrap configuration reader, attacked rather than exercised.
 *
 * THE TWO PROPERTIES WORTH A TEST are the ones a reviewer cannot see by reading the function: that
 * a half-configured environment is LOUD rather than skipped, and that no refusal message contains a
 * value. Both are the kind of rule that survives review and then quietly stops holding when
 * somebody adds a helpful `got "${password}"` to a message during a debugging session.
 */

const EMAIL = 'owner@example.com'
const PASSWORD = 'a-password-nobody-should-ever-see-printed'

describe('readBootstrapConfig', () => {
  it('is ABSENT when nothing is set, because that is not a misconfiguration', () => {
    expect(readBootstrapConfig({}).state).toBe('ABSENT')
  })

  it('treats an empty string as unset — a .env file full of NAME= lines is the usual reason', () => {
    expect(
      readBootstrapConfig({
        [BOOTSTRAP_VARIABLES.email]: '',
        [BOOTSTRAP_VARIABLES.password]: '   ',
      }).state,
    ).toBe('ABSENT')
  })

  it('defaults the role to owner, which is the account the Studio cannot create for itself', () => {
    const result = readBootstrapConfig({
      [BOOTSTRAP_VARIABLES.email]: EMAIL,
      [BOOTSTRAP_VARIABLES.password]: PASSWORD,
    })
    expect(result.state).toBe('READY')
    if (result.state !== 'READY') return
    expect(result.config.role).toBe(DEFAULT_BOOTSTRAP_ROLE)
    expect(result.config.role).toBe('owner')
    expect(result.config.displayName).toBeNull()
  })

  it('lower-cases the address, because staff_profiles.email is citext', () => {
    const result = readBootstrapConfig({
      [BOOTSTRAP_VARIABLES.email]: '  Owner@Example.COM ',
      [BOOTSTRAP_VARIABLES.password]: PASSWORD,
    })
    expect(result.state === 'READY' && result.config.email).toBe(EMAIL)
  })

  it('never trims the password: a trailing space is part of what somebody chose', () => {
    const padded = `${PASSWORD} `
    const result = readBootstrapConfig({
      [BOOTSTRAP_VARIABLES.email]: EMAIL,
      [BOOTSTRAP_VARIABLES.password]: padded,
    })
    expect(result.state === 'READY' && result.config.password).toBe(padded)
  })

  it('is INVALID — not ABSENT — for a half-set environment', () => {
    // The failure a silent skip would hide: somebody meant to configure this, and nobody finds out
    // until the day there is no account to sign in with.
    const noPassword = readBootstrapConfig({ [BOOTSTRAP_VARIABLES.email]: EMAIL })
    expect(noPassword.state).toBe('INVALID')

    const noEmail = readBootstrapConfig({ [BOOTSTRAP_VARIABLES.password]: PASSWORD })
    expect(noEmail.state).toBe('INVALID')

    // A lone optional variable counts as "halfway through configuring this" too.
    const roleOnly = readBootstrapConfig({ [BOOTSTRAP_VARIABLES.role]: 'admin' })
    expect(roleOnly.state).toBe('INVALID')
  })

  it('refuses a role that is not one of the six', () => {
    const result = readBootstrapConfig({
      [BOOTSTRAP_VARIABLES.email]: EMAIL,
      [BOOTSTRAP_VARIABLES.password]: PASSWORD,
      [BOOTSTRAP_VARIABLES.role]: 'superuser',
    })
    expect(result.state).toBe('INVALID')
    if (result.state !== 'INVALID') return
    // The allowed set, which is public. Never the submitted value.
    expect(result.problems.join(' ')).not.toContain('superuser')
  })

  it('refuses an address that is not one', () => {
    const result = readBootstrapConfig({
      [BOOTSTRAP_VARIABLES.email]: 'not-an-address',
      [BOOTSTRAP_VARIABLES.password]: PASSWORD,
    })
    expect(result.state).toBe('INVALID')
  })

  it('puts no value into any message — not the password, not the address, not a length', () => {
    const result = readBootstrapConfig({
      [BOOTSTRAP_VARIABLES.email]: 'not-an-address',
      [BOOTSTRAP_VARIABLES.password]: PASSWORD,
      [BOOTSTRAP_VARIABLES.role]: 'superuser',
      [BOOTSTRAP_VARIABLES.displayName]: 'Someone Real',
    })
    expect(result.state).toBe('INVALID')
    if (result.state !== 'INVALID') return

    const text = result.problems.join(' ')
    expect(text).not.toContain(PASSWORD)
    expect(text).not.toContain('not-an-address')
    expect(text).not.toContain('Someone Real')
    expect(text).not.toContain(String(PASSWORD.length))
    // It names the variables instead, which is what a caller can act on.
    expect(text).toContain(BOOTSTRAP_VARIABLES.email)
  })
})
