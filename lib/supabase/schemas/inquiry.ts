import { z } from 'zod'

import type { Enums, Tables } from '../database.types'

import { auditColumns, jsonSchema, timestampSchema, uuidSchema } from './common'

/**
 * `inquiries` and its two companions — the row schemas, and the SUBMISSION schemas that are the
 * trust boundary.
 *
 * TWO KINDS OF SCHEMA LIVE HERE AND THE DIFFERENCE MATTERS. A ROW schema describes what comes back
 * from the database: every column, non-optional, because the database wrote it. A SUBMISSION schema
 * describes what a stranger may send, and it is the only thing standing between an HTML form and an
 * INSERT. They are not the same shape and must never be derived from one another — a submission
 * that could name `pipeline_status` because the row has one is exactly the payload the RLS policy
 * exists to refuse, arriving with our own blessing.
 *
 * THE SUBMISSION SCHEMAS ARE PER KIND, as the phase document asks. A product enquiry must name a
 * product; a commission carries an answer set and no product; a general enquiry carries neither.
 * One permissive schema with everything optional would accept all three and check none of them.
 *
 * NOTHING HERE ACCEPTS A PRICE, A DEPOSIT OR AN ORDER (D1). There is no field to add one to: the
 * discriminated union below is closed, `.strict()` on each member, so an extra key is a validation
 * error rather than a silently ignored one.
 */

export const inquiryKindSchema = z.enum([
  'PRODUCT',
  'COMMISSION',
  'CONSULTATION',
  'QUOTE',
  'GENERAL',
]) satisfies z.ZodType<Enums<'inquiry_kind'>>

export const inquiryStatusSchema = z.enum([
  'NEW',
  'READ',
  'IN_CONVERSATION',
  'QUOTED',
  'WON',
  'LOST',
  'SPAM',
  'ARCHIVED',
]) satisfies z.ZodType<Enums<'inquiry_status'>>

export const whatsappStateSchema = z.enum([
  'NOT_SENT',
  'REDIRECTED',
  'SHORTENED',
  'UNAVAILABLE',
]) satisfies z.ZodType<Enums<'whatsapp_state'>>

export const inquiryEventKindSchema = z.enum([
  'CREATED',
  'WHATSAPP_REDIRECT',
  'VIEWED',
  'STATUS_CHANGED',
  'NOTE_ADDED',
  'ASSIGNED',
  'EXPORTED',
]) satisfies z.ZodType<Enums<'inquiry_event_kind'>>

/** `RIV-<yyyy>-<six digits>`, and six is a minimum width rather than a ceiling. */
export const referenceCodeSchema = z.string().regex(/^RIV-\d{4}-\d{6,}$/)

export const inquirySchema = z.object({
  id: uuidSchema,
  reference_code: referenceCodeSchema,
  kind: inquiryKindSchema,
  pipeline_status: inquiryStatusSchema,
  source_path: z.string().nullable(),
  product_id: uuidSchema.nullable(),
  collection_id: uuidSchema.nullable(),
  customization_form_id: uuidSchema.nullable(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  city: z.string().nullable(),
  message: z.string().nullable(),
  answers: jsonSchema,
  enquiry_type: z.string().nullable(),
  whatsapp_state: whatsappStateSchema,
  whatsapp_shortened_at_level: z.number().int().nullable(),
  consent_contact: z.boolean(),
  referrer: z.string().nullable(),
  utm: jsonSchema.nullable(),
  /** A salted hash. The column's CHECK refuses anything that is not 64 hex characters. */
  ip_hash: z.string().nullable(),
  user_agent: z.string().nullable(),
  assigned_to: uuidSchema.nullable(),
  ...auditColumns,
}) satisfies z.ZodType<Tables<'inquiries'>>

export type Inquiry = z.infer<typeof inquirySchema>

export const inquiryAttachmentSchema = z.object({
  inquiry_id: uuidSchema,
  media_asset_id: uuidSchema,
  position: z.number().int(),
  created_at: timestampSchema,
}) satisfies z.ZodType<Tables<'inquiry_attachments'>>

export type InquiryAttachment = z.infer<typeof inquiryAttachmentSchema>

export const inquiryEventSchema = z.object({
  id: uuidSchema,
  inquiry_id: uuidSchema,
  event: inquiryEventKindSchema,
  actor_id: uuidSchema.nullable(),
  from_status: inquiryStatusSchema.nullable(),
  to_status: inquiryStatusSchema.nullable(),
  note: z.string().nullable(),
  metadata: jsonSchema,
  occurred_at: timestampSchema,
}) satisfies z.ZodType<Tables<'inquiry_events'>>

export type InquiryEvent = z.infer<typeof inquiryEventSchema>

// -------------------------------------------------------------------------------------------------
// The trust boundary: what a stranger may send
// -------------------------------------------------------------------------------------------------

/**
 * A phone number, loosely.
 *
 * DELIBERATELY PERMISSIVE, AND THAT IS A DECISION RATHER THAN LAZINESS. A visitor in Surat may type
 * `98250 12345`, `+91 98250 12345` or `098250-12345`, and all three reach the same handset. A strict
 * E.164 rule would refuse two of them and lose the enquiry, which is a far worse outcome than
 * storing a number in the shape its owner wrote it. What IS enforced is that it contains enough
 * digits to be a phone number at all — which catches the empty submission and the typo, and nothing
 * else. The studio reads it and dials it; nothing parses it.
 */
const phoneSchema = z
  .string()
  .trim()
  .min(6)
  .max(32)
  .refine((value) => (value.match(/\d/g) ?? []).length >= 7, {
    message: 'That does not look like a phone number.',
  })

/** Empty string is what an untouched optional input submits, and it means "not given". */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()

const commonFields = {
  name: z.string().trim().min(1).max(120),
  phone: phoneSchema,
  email: z
    .union([z.literal(''), z.email().max(200)])
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
  city: optionalText(120).optional(),
  message: optionalText(4000).optional(),
  /** Where the visitor was. Recorded for the studio; never rendered and never in a message. */
  sourcePath: optionalText(300).optional(),
  consentContact: z.boolean().optional(),
  /**
   * THE HONEYPOT. A field no human sees and no human fills; a bot fills every input it finds. It is
   * accepted rather than rejected by the schema so that the ACTION can decide what to do with a
   * filled one — which is to return the ordinary success state and write nothing, because telling a
   * bot it was detected is telling its author what to change.
   */
  website: z.string().max(200).optional(),
  /** Milliseconds since the form was rendered. Under three seconds is not a person typing. */
  elapsedMs: z.coerce.number().int().nonnegative().optional(),
  /** `{ publicId, filename }` pairs from the Phase 19 upload endpoint. */
  references: z
    .array(z.object({ publicId: z.string().max(400), filename: z.string().max(300) }).strict())
    .max(5)
    .optional(),
}

/**
 * The five submissions, as a discriminated union.
 *
 * A UNION RATHER THAN A SUPERSET, so each kind's obligations are checked rather than described. A
 * `PRODUCT` enquiry without a product is refused here as well as by the column constraint; a
 * `COMMISSION` carries its answer set and its form id; a `GENERAL` enquiry from the contact form
 * carries the SEED §22 enquiry type and nothing structural at all.
 *
 * EVERY MEMBER IS `.strict()`. An unexpected key is a validation error, not a value quietly
 * dropped — which is what stops `pipeline_status` or `assigned_to` from arriving in the payload and
 * being ignored in a way nobody notices until the ignoring stops.
 */
export const inquirySubmissionSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('PRODUCT'),
      productId: uuidSchema,
      ...commonFields,
    })
    .strict(),
  z
    .object({
      kind: z.literal('COMMISSION'),
      formId: uuidSchema,
      productId: uuidSchema.nullable().optional(),
      /** The configurator's field key → answer map, exactly as `lib/cms/forms.ts` validated it. */
      answers: z.record(z.string(), z.unknown()),
      ...commonFields,
    })
    .strict(),
  z
    .object({
      kind: z.literal('CONSULTATION'),
      ...commonFields,
    })
    .strict(),
  z
    .object({
      kind: z.literal('QUOTE'),
      productId: uuidSchema.nullable().optional(),
      ...commonFields,
    })
    .strict(),
  z
    .object({
      kind: z.literal('GENERAL'),
      /** SEED §22's eight types. Free text: the list is editorial, not structural. */
      enquiryType: optionalText(120).optional(),
      ...commonFields,
    })
    .strict(),
])

export type InquirySubmission = z.infer<typeof inquirySubmissionSchema>
