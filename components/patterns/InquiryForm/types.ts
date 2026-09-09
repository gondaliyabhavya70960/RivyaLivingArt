/**
 * Everything the enquiry form needs that is not a field the visitor fills in.
 *
 * RESOLVED ON THE SERVER AND PASSED ACROSS THE BOUNDARY, exactly as the configurator's copy is.
 * `InquiryForm` is a Client Component and cannot read `global_content`; handing it a `SiteStrings`
 * map would work and would also hand it every string on the site. It gets the fourteen it uses.
 */
export interface InquiryCopy {
  readonly name: string
  readonly phone: string
  readonly email: string
  readonly city: string
  readonly enquiryType: string
  readonly message: string
  readonly required: string
  readonly submit: string
  readonly sending: string
  /** SEED §48. Shown only after the write succeeded — the sentence is a claim the product must earn. */
  readonly successHeading: string
  readonly successBody: string
  /** `{{code}}` is substituted with the reference code the database allocated. */
  readonly reference: string
  readonly continueToWhatsApp: string
  readonly savedWithoutWhatsApp: string
  /** SEED §49, the three of them. */
  readonly errorGeneric: string
  readonly errorSave: string
  readonly errorTooMany: string
}

/** The five kinds a public surface may submit. `CONSULTATION` has no surface yet. */
export type InquiryFormKind = 'GENERAL' | 'PRODUCT' | 'QUOTE' | 'COMMISSION' | 'CONSULTATION'
