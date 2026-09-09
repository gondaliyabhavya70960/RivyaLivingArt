'use server'

import { randomUUID } from 'node:crypto'

import { headers } from 'next/headers'

import { summariseAnswers } from '@/lib/cms/forms'
import { siteString } from '@/lib/cms/strings'
import { optionalEnv } from '@/lib/env'
import {
  INQUIRY_SUBMIT_WINDOWS,
  addressFromHeaders,
  bucketKey,
  consume,
} from '@/lib/security/rate-limit'
import { getSiteChrome } from '@/lib/site/chrome'
import { createPublicClient } from '@/lib/supabase/public'
import { getFormById } from '@/lib/supabase/repositories/customization-forms'
import {
  attachInquiryReferences,
  createInquiry,
  inquiryReferenceCode,
  recordInquiryHandoff,
} from '@/lib/supabase/repositories/inquiries'
import { getProductById } from '@/lib/supabase/repositories/catalog-admin'
import { inquirySubmissionSchema, type InquirySubmission } from '@/lib/supabase/schemas'
import {
  TEMPLATE_KEYS,
  buildHandoffUrl,
  resolveWhatsAppNumber,
  type TemplateName,
  type TokenValues,
} from '@/lib/whatsapp'

/**
 * The one public write path on this site, and the enforcement of the rule the whole product turns
 * on: PERSIST, THEN REDIRECT — never the reverse (D1, SEED §49).
 *
 * THREE THINGS MAKE THAT ENFORCEABLE RATHER THAN ASPIRATIONAL, and none of them is this comment.
 *
 *   1. `buildHandoffUrl` takes a non-optional `inquiryId`. A call before the insert has no value to
 *      pass and does not type-check.
 *   2. This action returns a DISCRIMINATED UNION. The client must narrow `ok` before it can read a
 *      URL, and the failure branch has no URL to read — not an empty string, not a null: the
 *      property does not exist on that member.
 *   3. `tests/unit/inquiry-persistence.test.ts` forces the insert to fail and asserts the returned
 *      object carries no URL at all.
 *
 * IT WRITES WITH THE ANONYMOUS CLIENT, AND THAT IS THE POINT. Every other write in this codebase
 * runs behind `requirePermission`; this one has no session to check, because D1 forbids customer
 * accounts and the person filling in the form is nobody. So `inquiries_insert_public` — which pins
 * the row to the start of the pipeline, unassigned, with no claimed editor — is the guard, and
 * using the service-role client here would step around the only thing guarding the table.
 *
 * IT NEVER READS AN ENQUIRY BACK. `anon` has no SELECT policy and PostgreSQL applies it to an
 * INSERT's RETURNING clause too, so the id is generated HERE and the trigger-allocated reference
 * code comes back through a narrow SECURITY DEFINER lookup (amendment A20).
 *
 * A FAILED HANDOFF NEVER FAILS THE SUBMISSION. Once the row is written the enquiry has arrived;
 * everything after that — attachments, the message, the bookkeeping — is best-effort, and an error
 * in any of it must not tell the visitor their brief was lost when it was not.
 */

export type InquiryFailure =
  /** Zod refused the payload. The fields are named so the form can point at them. */
  | { readonly ok: false; readonly code: 'invalid'; readonly fields: readonly string[] }
  /** Too many from this address in an hour. */
  | { readonly ok: false; readonly code: 'rate_limited' }
  /** The write did not happen. There is no URL on this branch, and that is the guarantee. */
  | { readonly ok: false; readonly code: 'save_failed' }

export type InquirySuccess = {
  readonly ok: true
  readonly referenceCode: string
  /**
   * `null` when no number resolved. The enquiry is saved either way and the success state shows the
   * reference code and the studio's other contact details rather than a dead link.
   */
  readonly whatsappUrl: string | null
  readonly attachments: number
}

export type SubmitInquiryResult = InquirySuccess | InquiryFailure

/** SEED §49's minimum time-to-submit. Nobody reads a form and answers it in under three seconds. */
const MIN_SUBMIT_MS = 3_000

const TEMPLATE_FOR: Record<InquirySubmission['kind'], TemplateName> = {
  PRODUCT: 'inquiry',
  COMMISSION: 'commission',
  CONSULTATION: 'inquiry',
  QUOTE: 'inquiry',
  GENERAL: 'inquiry',
}

/**
 * Was this submitted by a machine?
 *
 * TWO SIGNALS AND NO CAPTCHA. SECURITY.md forbids a third-party captcha — it is a tracker on a
 * page that collects a phone number — so spam control is a field no human sees and a clock. Both
 * are cheap, neither tracks anybody, and a determined attacker beats both; what they stop is the
 * ninety-nine per cent of form spam that is a script posting to whatever it found.
 */
function looksAutomated(submission: InquirySubmission): boolean {
  if ((submission.website ?? '') !== '') return true
  const elapsed = submission.elapsedMs
  return elapsed !== undefined && elapsed < MIN_SUBMIT_MS
}

/** Every line of a commission brief a visitor agreed to send, as `Label: value`. */
async function commissionSummary(
  formId: string,
  answers: Readonly<Record<string, unknown>>,
): Promise<{ summary: string; projectType: string; dimensions: string; materials: string }> {
  const client = createPublicClient()
  const form = await getFormById(client, formId).catch(() => null)
  if (form === null) return { summary: '', projectType: '', dimensions: '', materials: '' }

  const lines = summariseAnswers(form, answers).filter((line) => line.includeInWhatsApp)
  const pick = (key: string): string => lines.find((line) => line.fieldKey === key)?.value ?? ''

  return {
    summary: lines.map((line) => `${line.label}: ${line.value}`).join('\n'),
    projectType: pick('project_type'),
    // The dimension step's answers, in the order the form asks them.
    dimensions: lines
      .filter((line) => line.stepKey === 'dimensions')
      .map((line) => `${line.label} ${line.value}`)
      .join(' × '),
    materials: [pick('wood'), pick('resin_direction'), pick('colour'), pick('finish')]
      .filter((value) => value !== '')
      .join(', '),
  }
}

/** The product's title, for `{{product_or_project}}`. Never invented: empty when it cannot be read. */
async function productTitle(productId: string | null | undefined): Promise<string> {
  if (productId === null || productId === undefined) return ''
  const product = await getProductById(createPublicClient(), productId).catch(() => null)
  return product?.title ?? ''
}

export async function submitInquiry(payload: unknown): Promise<SubmitInquiryResult> {
  const parsed = inquirySubmissionSchema.safeParse(payload)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'invalid',
      fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? '_form')))],
    }
  }
  const submission = parsed.data

  const requestHeaders = await headers()
  const address = addressFromHeaders(requestHeaders)

  /*
   * THE LIMIT IS CONSUMED BEFORE ANYTHING ELSE IS DECIDED, including the spam signals. A flood that
   * trips the honeypot on every request must still cost its sender their hourly allowance;
   * returning early on the cheap check would make the expensive one unreachable.
   */
  const { allowed } = await consume(bucketKey('inq', address), INQUIRY_SUBMIT_WINDOWS)
  if (!allowed) return { ok: false, code: 'rate_limited' }

  /*
   * A MACHINE GETS THE ORDINARY FAILURE, NOT A SPECIFIC ONE. Saying "you tripped the honeypot"
   * tells its author exactly what to change. Saying "saved!" would be worse: a password manager
   * that fills a hidden field would tell a real person their enquiry arrived when nothing was
   * written, and this codebase does not fabricate a reference code for anybody.
   */
  if (looksAutomated(submission)) return { ok: false, code: 'save_failed' }

  const id = randomUUID()
  const client = createPublicClient()
  const chrome = await getSiteChrome()

  const commission =
    submission.kind === 'COMMISSION'
      ? await commissionSummary(submission.formId, submission.answers)
      : null

  try {
    await createInquiry(client, {
      id,
      kind: submission.kind,
      name: submission.name,
      phone: submission.phone,
      email: submission.email ?? null,
      city: submission.city ?? null,
      message: submission.message ?? null,
      source_path: submission.sourcePath ?? null,
      consent_contact: submission.consentContact ?? true,
      product_id:
        submission.kind === 'PRODUCT'
          ? submission.productId
          : submission.kind === 'QUOTE' || submission.kind === 'COMMISSION'
            ? (submission.productId ?? null)
            : null,
      customization_form_id: submission.kind === 'COMMISSION' ? submission.formId : null,
      answers:
        submission.kind === 'COMMISSION'
          ? (submission.answers as Record<string, never>)
          : undefined,
      enquiry_type: submission.kind === 'GENERAL' ? (submission.enquiryType ?? null) : null,
      referrer: requestHeaders.get('referer'),
      user_agent: requestHeaders.get('user-agent'),
      ip_hash: bucketKey('ip', address).split(':')[1] ?? null,
    })
  } catch {
    /*
     * THE ONE BRANCH THAT MATTERS. Nothing was written, so nothing may be returned that could be
     * used to navigate: this member of the union has no `whatsappUrl` property at all, and the
     * client cannot read one from it even by mistake.
     */
    return { ok: false, code: 'save_failed' }
  }

  // From here the enquiry EXISTS. Everything below is best-effort, and every failure in it is
  // swallowed, because telling the visitor their brief was lost when it was saved is the worse lie.
  let referenceCode = ''
  try {
    referenceCode = await inquiryReferenceCode(client, id)
  } catch {
    referenceCode = ''
  }

  let attachments = 0
  if (submission.references !== undefined && submission.references.length > 0) {
    try {
      attachments = await attachInquiryReferences(client, id, submission.references)
    } catch {
      attachments = 0
    }
  }

  const number = resolveWhatsAppNumber(
    chrome.contact,
    chrome.contactVerified,
    optionalEnv('NEXT_PUBLIC_WHATSAPP_NUMBER'),
  )

  const template = TEMPLATE_FOR[submission.kind]
  const body = siteString(chrome.strings, TEMPLATE_KEYS[template])

  // No number, or no seeded template: the enquiry stands, the visitor gets their reference code and
  // the studio's contact details, and the row says the handoff was unavailable rather than pretending.
  if (number === null || body === null || referenceCode === '') {
    await recordInquiryHandoff(client, id, 'UNAVAILABLE', null).catch(() => false)
    return { ok: true, referenceCode, whatsappUrl: null, attachments }
  }

  const values: TokenValues =
    template === 'commission'
      ? {
          project_type: commission?.projectType ?? '',
          dimensions: commission?.dimensions ?? '',
          city: submission.city ?? '',
          material_direction: commission?.materials ?? '',
          notes: submission.message ?? '',
          reference_urls: attachments === 0 ? '' : `${attachments}`,
        }
      : {
          product_or_project: await productTitle(
            'productId' in submission ? submission.productId : null,
          ),
          customer_name: submission.name,
          phone: submission.phone,
          city: submission.city ?? '',
          customization_summary: commission?.summary ?? '',
          notes: submission.message ?? '',
          reference_urls: attachments === 0 ? '' : `${attachments}`,
        }

  try {
    const handoff = buildHandoffUrl({
      // The REFERENCE CODE, not the uuid. It is what the owner searches for in Studio, and what a
      // customer can quote back down the phone.
      inquiryId: referenceCode,
      template,
      body,
      values,
      number,
    })

    await recordInquiryHandoff(
      client,
      id,
      handoff.level === null ? 'REDIRECTED' : 'SHORTENED',
      handoff.level,
    ).catch(() => false)

    return { ok: true, referenceCode, whatsappUrl: handoff.url, attachments }
  } catch {
    await recordInquiryHandoff(client, id, 'UNAVAILABLE', null).catch(() => false)
    return { ok: true, referenceCode, whatsappUrl: null, attachments }
  }
}
