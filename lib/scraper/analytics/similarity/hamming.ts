import { assertBits64, type Bits64 } from './gray'

/** The number of positions at which two 64-bit hashes differ. 0 is identical; 32 is unrelated. */
export function hamming(left: Bits64, right: Bits64): number {
  assertBits64(left, 'left')
  assertBits64(right, 'right')
  let distance = 0
  for (let i = 0; i < 64; i += 1) if (left[i] !== right[i]) distance += 1
  return distance
}

/** `bit(64)` → the hex form PostgreSQL and the docs use. */
export function bitsToHex(bits: Bits64): string {
  assertBits64(bits)
  let hex = ''
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  return hex
}
