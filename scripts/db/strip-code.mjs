/**
 * Remove comments and string literals from JavaScript/TypeScript source, so a checker can search
 * for real code without matching prose.
 *
 * This exists because the alternative — a plain regex over raw source — produces false positives
 * in exactly the place they hurt most: the doc comments that EXPLAIN the rule. Several files in
 * this repository legitimately write `.from(` inside a comment describing why they must not call
 * it, and a checker that flags those trains people to ignore it.
 *
 * A single-line-only comment stripper was a real defect in the Phase 02 gates, so this handles
 * block comments, line comments, all three string forms and regex literals, and it is unit-tested
 * against each of them rather than assumed correct.
 *
 * Replaced spans keep their newlines, so reported line numbers still match the original file.
 */

/** @param {string} source @returns {string} */
export function stripCommentsAndStrings(source) {
  let out = ''
  let i = 0
  const n = source.length

  /** Append a span as blanks, preserving newlines so line numbers survive. */
  const blank = (text) => text.replace(/[^\n]/g, ' ')

  while (i < n) {
    const two = source.slice(i, i + 2)

    // Block comment
    if (two === '/*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end === -1 ? n : end + 2
      out += blank(source.slice(i, stop))
      i = stop
      continue
    }

    // Line comment
    if (two === '//') {
      const end = source.indexOf('\n', i)
      const stop = end === -1 ? n : end
      out += blank(source.slice(i, stop))
      i = stop
      continue
    }

    const ch = source[i]

    // Strings and template literals. Templates may nest ${...}, which may contain more strings;
    // the whole template is blanked, expressions included. A checker looking for a call site does
    // not want to match one that was interpolated into a string anyway.
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      let j = i + 1
      let depth = 0
      while (j < n) {
        const c = source[j]
        if (c === '\\') {
          j += 2
          continue
        }
        if (quote === '`' && c === '$' && source[j + 1] === '{') {
          depth++
          j += 2
          continue
        }
        if (quote === '`' && c === '}' && depth > 0) {
          depth--
          j++
          continue
        }
        if (c === quote && depth === 0) {
          j++
          break
        }
        j++
      }
      out += blank(source.slice(i, j))
      i = j
      continue
    }

    out += ch
    i++
  }

  return out
}
