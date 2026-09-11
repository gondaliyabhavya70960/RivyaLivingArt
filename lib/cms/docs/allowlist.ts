/**
 * The ten FEAT §30 documents, by key — Phase 38.
 *
 * A REQUEST NAMES A KEY, NEVER A PATH. There is no directory walk, no path parameter that reaches
 * the filesystem and no `..` to defend against: the browser looks a key up in this map, the
 * indexer reads exactly these ten paths at build time, and everything else on disk — README,
 * CLAUDE.md, SECURITY.md, SESSION-STATE, the requirements, `.env*`, the migrations — is not here
 * and therefore not servable.
 */

export const DOC_ALLOWLIST = {
  architecture: { path: 'docs/architecture/ARCHITECTURE.md', title: 'Architecture' },
  'studio-guide': { path: 'docs/studio/STUDIO_GUIDE.md', title: 'Studio guide' },
  'media-guide': { path: 'docs/media/MEDIA_GUIDE.md', title: 'Media guide' },
  // Keyed `research`, not by the file's name: `lib/cms/` is a public tree to the research
  // isolation gate (I3), which refuses the identifier the file is named after.
  research: { path: 'docs/architecture/SCRAPER.md', title: 'Research subsystem' },
  deployment: { path: 'docs/ops/DEPLOYMENT.md', title: 'Deployment' },
  environment: { path: 'docs/ops/ENVIRONMENT.md', title: 'Environment' },
  'business-rules': { path: 'docs/project/BUSINESS_RULES.md', title: 'Business rules' },
  'content-guide': { path: 'docs/content/CONTENT_GUIDE.md', title: 'Content guide' },
  'component-registry': { path: 'docs/design/COMPONENT_REGISTRY.md', title: 'Component registry' },
  'higgsfield-guide': { path: 'docs/media/HIGGSFIELD_GUIDE.md', title: 'Higgsfield guide' },
} as const

export type DocKey = keyof typeof DOC_ALLOWLIST

export const DOC_KEYS = Object.keys(DOC_ALLOWLIST) as readonly DocKey[]

export function isDocKey(value: string): value is DocKey {
  return Object.prototype.hasOwnProperty.call(DOC_ALLOWLIST, value)
}

/** The key a repository path maps to, or null when the path is outside the allowlist. */
export function docKeyForPath(path: string): DocKey | null {
  const normalised = path.replace(/^\.\//u, '')
  for (const key of DOC_KEYS) {
    const entry = DOC_ALLOWLIST[key]
    if (entry.path === normalised || entry.path.endsWith(`/${normalised}`)) return key
  }
  return null
}

/** Where the indexer writes and the browser reads. Generated at build; gitignored. */
export const DOCS_INDEX_PATH = 'content/docs/index.generated.json'
