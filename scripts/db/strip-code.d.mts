/**
 * Type declaration for strip-code.mjs.
 *
 * The implementation stays plain JavaScript because it is imported by check-data-layer.mjs, which
 * Node runs directly with no build step. This file gives the same module a type for the unit test
 * and for `npm run typecheck`, which covers scripts/ and tests/ as well as application code.
 */
export declare function stripCommentsAndStrings(source: string): string
