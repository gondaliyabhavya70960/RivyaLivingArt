import type { CustomizationFormField, CustomizationFormStep } from '@/lib/supabase/schemas'

/**
 * What the server hands the configurator.
 *
 * A PLAIN OBJECT, NOT A `SiteStrings` MAP AND NOT A REPOSITORY RESULT. Everything here crosses the
 * server/client boundary, so it is resolved on the server and serialised: the client component
 * never reads `global_content`, never queries anything, and cannot be given a database client by
 * accident. It also means the copy is fixed at render time, which is what makes the whole
 * configurator testable without a database.
 *
 * A MISSING STRING IS AN EMPTY STRING, NOT A DEFAULT. `lib/cms/strings.ts` sets that rule for every
 * public string and the reason holds here: a fallback would put a sentence nobody wrote on the
 * public site, invisibly, because the page would look finished.
 */
export interface ConfiguratorCopy {
  readonly progress: string
  readonly progressLabel: string
  readonly next: string
  readonly back: string
  readonly review: string
  readonly reviewEdit: string
  readonly reviewEmpty: string
  readonly optional: string
  readonly required: string
  readonly uploadChoose: string
  readonly uploadHint: string
  readonly uploadRemove: string
  readonly uploading: string
  readonly saved: string
  readonly stepErrors: string
  readonly uploadError: string
  /** `customization_forms.submit_label_key`, resolved. Empty when the key names no enabled row. */
  readonly submit: string
}

/** One step and its fields, serialised. The shape `lib/cms/forms.ts` already works in. */
export interface ConfiguratorStep {
  readonly step: CustomizationFormStep
  readonly fields: readonly CustomizationFormField[]
}

export interface ConfiguratorDefinition {
  readonly formId: string
  readonly slug: string
  readonly introHeading: string | null
  readonly introBody: string | null
  readonly steps: readonly ConfiguratorStep[]
}

/** What the upload endpoint enforces, echoed so the hint can state it without hard-coding it. */
export interface UploadLimits {
  readonly maxFiles: number
  readonly maxBytes: number
}
