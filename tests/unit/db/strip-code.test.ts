import { describe, expect, it } from 'vitest'

import { stripCommentsAndStrings } from '../../../scripts/db/strip-code.mjs'

/**
 * The comment/string stripper the layering gate depends on.
 *
 * These tests exist because the equivalent stripper in the Phase 02 gates handled only single-line
 * comments, and the resulting false positives were found by hand rather than by a test. A stripper
 * that is subtly wrong makes its gate either useless (misses violations) or ignored (cries wolf),
 * and both failures are silent.
 */
describe('stripCommentsAndStrings', () => {
  it('removes line comments', () => {
    expect(stripCommentsAndStrings('const a = 1 // client.from("x")')).not.toContain('.from(')
  })

  it('removes block comments, including multi-line ones', () => {
    const source = ['/*', ' * client.from("products")', ' */', 'const a = 1'].join('\n')
    expect(stripCommentsAndStrings(source)).not.toContain('.from(')
  })

  it('removes double-quoted, single-quoted and template strings', () => {
    expect(stripCommentsAndStrings('const a = "x.from(1)"')).not.toContain('.from(')
    expect(stripCommentsAndStrings("const a = 'x.from(1)'")).not.toContain('.from(')
    expect(stripCommentsAndStrings('const a = `x.from(1)`')).not.toContain('.from(')
  })

  it('removes template interpolations too', () => {
    expect(stripCommentsAndStrings('const a = `${db.from("t")}`')).not.toContain('.from(')
  })

  it('does not remove real code', () => {
    expect(stripCommentsAndStrings('client.from("products")')).toContain('.from(')
  })

  it('handles an escaped quote inside a string without running past its end', () => {
    // If the escape were mishandled, the string would appear unterminated and the rest of the
    // file — including any real call — would be blanked, silently disabling the gate.
    const source = 'const a = "he said \\"hi\\""\nclient.from("products")'
    const stripped = stripCommentsAndStrings(source)
    expect(stripped).toContain('.from(')
  })

  it('preserves line numbers', () => {
    const source = ['/* a', ' b', ' c */', 'client.from("x")'].join('\n')
    const stripped = stripCommentsAndStrings(source)
    expect(stripped.split('\n')).toHaveLength(4)
    expect(stripped.split('\n')[3]).toContain('.from(')
  })

  it('leaves an unterminated block comment blanked rather than throwing', () => {
    expect(() => stripCommentsAndStrings('/* never closed')).not.toThrow()
  })
})
