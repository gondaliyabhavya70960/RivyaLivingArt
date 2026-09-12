/**
 * Typed surface of `audit-docs.mjs` for `tests/unit/docs-audit.test.ts`; the implementation is the
 * `.mjs`, and this file exists because `tsconfig.json` sets `allowJs: false` — the same arrangement
 * `scripts/db/strip-code.d.mts` and `scripts/sheets/no-read.d.mts` already use.
 *
 * Only what the test and `check-doc-contract.mjs --claims` need is declared. A declaration added
 * here that the `.mjs` does not export is a lie the compiler will believe, so keep the two in step.
 */
export declare const CONTRACT_PATH: string
export declare const ROADMAP_PATH: string
export declare const DOCS_DIR: string
export declare const READ_ONLY_PREFIX: string
export declare const PREDATES_FRONT_MATTER: readonly string[]
export declare const FRONT_MATTER_KEYS: readonly string[]
export declare const STATUS_VALUES: readonly string[]
export declare const UNFINISHED_STATUSES: readonly string[]
export declare const CLAIM_TERMS: readonly string[]
export declare const PROHIBITION_MARKERS: readonly RegExp[]

export declare function listDocFiles(root: string, dir?: string, out?: string[]): string[]
export declare function expandBraces(pattern: string): string[]
export declare function parseD7Map(contractText: string): string[]
export declare function resolvesOnDisk(root: string, pattern: string): boolean
export declare function checkD7Completeness(root: string): {
  patterns: string[]
  problems: string[]
}
export declare function parseFrontMatter(text: string): {
  present: boolean
  keys: Record<string, string>
  unterminated?: boolean
}
export declare function isIsoDate(value: string): boolean
export declare function frontMatterProblems(path: string, text: string): string[]
export declare function frontMatterTargets(root: string): string[]
export declare function checkFrontMatter(root: string): { targets: string[]; problems: string[] }
export declare function parseD8ServerOnly(contractText: string): string[]
export declare function isPlaceholder(value: string): boolean
export declare function scanSecrets(
  text: string,
  names: readonly string[],
): { line: number; name: string; rule: string; length: number }[]
export declare function checkSecrets(root: string): {
  names: string[]
  scanned: string[]
  problems: string[]
}
export declare function parseRoadmapStatuses(roadmapText: string): {
  supported: boolean
  reason?: string
  statuses: Map<string, string>
}
export declare function isPhaseComplete(statusCell: string): boolean
export declare function checkCurrentDocumentsAgainstRoadmap(root: string): {
  problems: string[]
  checked: number
  skipped: string | null
}
export declare function blockFor(lines: readonly string[], index: number): string
export declare function scanClaims(
  text: string,
): { line: number; term: string; verdict: 'SYSTEM' | 'PROHIBITED' | 'ASSERTION'; text: string }[]
export declare function checkClaims(root: string): {
  scanned: string[]
  counts: { SYSTEM: number; PROHIBITED: number; ASSERTION: number }
  problems: string[]
}
export declare function generatorOf(text: string): string | null
