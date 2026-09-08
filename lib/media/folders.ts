/**
 * Every Cloudinary folder this product may write to.
 *
 * WHY AN ALLOWLIST AT ALL. The sign endpoint takes a folder from the client. Without this list a
 * signed upload could be directed anywhere in the account — over another project's assets, or into
 * a path nothing ever audits. The signature is what makes the upload possible, so the constraint
 * has to be applied *before* signing, not after.
 *
 * THE FIRST 23 ARE NOT WRITTEN BY HAND. They are the distinct `cloudinary_folder` values in
 * `data/higgsfield/asset-manifest.json`, and `scripts/media/check-folders.mjs` fails the build if
 * this list and the manifest disagree. D6 says "Cloudinary folders follow the manifest's
 * `cloudinary_folder`", and a hand-maintained copy of 23 strings is a promise that decays.
 *
 * The rest are RESERVED: real destinations for phases that have not run yet, empty at the end of
 * Phase 06. They are listed rather than added later so that the sign endpoint does not have to be
 * edited by a phase whose subject is something else entirely.
 */

/** The 23 folders the Higgsfield manifest actually uses. Asserted equal by the folder gate. */
export const MANIFEST_FOLDERS = [
  'rivya/collection/3d-resin',
  'rivya/collection/decor',
  'rivya/collection/gifts',
  'rivya/collection/preservation',
  'rivya/collection/wall-art',
  'rivya/interior',
  'rivya/journal/editorial',
  'rivya/journal/workshop',
  'rivya/large-format/architectural',
  'rivya/large-format/coffee',
  'rivya/large-format/console',
  'rivya/large-format/dining',
  'rivya/large-format/seating',
  'rivya/large-format/side',
  'rivya/material',
  'rivya/portfolio/gallery',
  'rivya/process/cure',
  'rivya/process/finish',
  'rivya/process/mould',
  'rivya/process/pigment',
  'rivya/process/pour',
  'rivya/process/studio',
  'rivya/process/timber',
] as const

/**
 * Folders no manifest asset occupies yet.
 *
 * `rivya/product/**` is a PREFIX rather than a fixed folder: one per product slug, minted by
 * Phase 14. It is handled by `isAllowedFolder` rather than enumerated, because the set is
 * unbounded and only known at runtime.
 */
export const RESERVED_FOLDERS = ['rivya/brand', 'rivya/documents', 'rivya/models'] as const

/** The prefix under which Phase 14 mints one folder per product slug. */
export const PRODUCT_FOLDER_PREFIX = 'rivya/product/'

export const ALLOWED_FOLDERS: readonly string[] = [...MANIFEST_FOLDERS, ...RESERVED_FOLDERS]

/**
 * A product folder is `rivya/product/<slug>` and nothing deeper.
 *
 * The slug pattern is the same shape `rivya_slugify()` produces: lower-case, digits and single
 * hyphens. Anything else — an empty segment, a further slash, an uppercase letter, a dot — is
 * refused. `..` is impossible under this pattern, which is what stops a traversal reaching another
 * account folder.
 */
const PRODUCT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isAllowedFolder(folder: string): boolean {
  if (ALLOWED_FOLDERS.includes(folder)) return true
  if (!folder.startsWith(PRODUCT_FOLDER_PREFIX)) return false
  return PRODUCT_SLUG.test(folder.slice(PRODUCT_FOLDER_PREFIX.length))
}

export class DisallowedFolderError extends Error {
  readonly kind = 'disallowed-folder' as const
  constructor(readonly folder: string) {
    // The folder is echoed because it came from our own client and naming it is what makes the
    // failure diagnosable. It is not secret, and it is not free text from a visitor.
    super(`"${folder}" is not an allowed Cloudinary folder`)
    this.name = 'DisallowedFolderError'
  }
}

/** Throws unless the folder is allowed. Called before a signature is produced, never after. */
export function assertFolder(folder: string): void {
  if (!isAllowedFolder(folder)) throw new DisallowedFolderError(folder)
}
