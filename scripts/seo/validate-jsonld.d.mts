export declare const FORBIDDEN_KEYS: readonly string[]
export declare const FORBIDDEN_TYPES: readonly string[]
export declare function forbiddenIn(node: unknown, at?: string): string[]
export declare function blocksIn(html: string): { blocks: unknown[]; problems: string[] }
