import { requiredEnv } from '@/lib/env'

import { shorten, type ShortenResult } from './shorten'
import { renderTemplate, type TemplateName, type TokenValues } from './templates'

/**
 * The two ways this product may open WhatsApp, and the difference between them is the D1 business
 * rule expressed as a type.
 *
 * `buildHandoffUrl` REQUIRES A PERSISTED INQUIRY ID. Not "accepts", not "recommends": `inquiryId`
 * is a non-optional `string` on the parameter object, so a call site that has not saved an inquiry
 * cannot produce a value for it and does not compile. That is the enforcement mechanism for "an
 * inquiry must be persisted before any WhatsApp redirect" — a rule that is otherwise a sentence in
 * a document which every future conversion surface has to remember. `tests/unit/whatsapp-template
 * .test.ts` asserts the compile failure against a fixture, because a type-level guarantee that is
 * never tested is a guarantee that quietly becomes optional.
 *
 * `buildDirectContactUrl` CARRIES NO INQUIRY DATA AT ALL. It opens a chat with a greeting and
 * nothing else, and its `source` is a closed union of the three surfaces the phase document
 * permits. A product page cannot call it, because `'product'` is not a member — so the shape of
 * the type is what keeps a "chat with us" button off a surface where the conversion must be
 * recorded first.
 *
 * NEITHER BUILDER IS THE ONLY DEFENCE. `scripts/site/check-whatsapp-usage.mjs` bans the literal
 * hosts anywhere outside this directory, so a hand-written `https://wa.me/...` fails CI rather
 * than quietly bypassing both.
 */

/**
 * `wa.me` takes digits only: no `+`, no spaces, no punctuation.
 *
 * THE CALLER MAY SUPPLY THE NUMBER, and from Phase 20 the conversion path does. `lib/whatsapp/
 * number.ts` resolves it from `global_content` (PUBLISHED, enabled, VERIFIED) and falls back to the
 * environment, so the owner can change the studio's number without a deployment. When no number is
 * passed the environment variable is still the answer, which keeps the three chrome surfaces and
 * every existing call site working unchanged.
 */
function phoneDigits(supplied?: string): string {
  const raw = supplied ?? requiredEnv('NEXT_PUBLIC_WHATSAPP_NUMBER')
  return raw.replace(/\D/gu, '')
}

function urlFor(message: string, number?: string): string {
  return `https://wa.me/${phoneDigits(number)}?text=${encodeURIComponent(message)}`
}

/** The prefix's length, for the shortener's arithmetic — everything but the message. */
function prefixLength(number?: string): number {
  return `https://wa.me/${phoneDigits(number)}?text=`.length
}

export type HandoffInput = {
  /**
   * The id of the row that was already written. REQUIRED, and deliberately not `string | null`:
   * see this module's header. Phase 20 supplies it from the insert it has just performed.
   */
  readonly inquiryId: string
  readonly template: TemplateName
  /** The template body, read from `global_content` by the caller — never hardcoded here. */
  readonly body: string
  /** Everything except `inquiry_id`, which this function supplies from `inquiryId`. */
  readonly values: TokenValues
  /**
   * The studio's number, already normalised to digits. Optional: without it the environment
   * variable is used, which is what every pre-Phase-20 call site does.
   */
  readonly number?: string
}

export type HandoffUrl = {
  readonly url: string
  readonly message: string
} & Pick<ShortenResult, 'overLimit' | 'level'>

/**
 * The post-persistence handoff.
 *
 * `inquiry_id` IS SET HERE AND CANNOT BE OVERRIDDEN. Taking it from `values` as well would let a
 * caller pass a different id than the row it just wrote — accidentally, by spreading a form object
 * — and the message would then reference an inquiry that does not exist. The parameter is the
 * single source, and it is applied last.
 */
export function buildHandoffUrl(input: HandoffInput): HandoffUrl {
  /*
   * A RUNTIME GUARD BEHIND THE TYPE, AND IT EARNED ITS PLACE.
   *
   * The non-optional `inquiryId` stops a TypeScript caller at compile time, and the first draft
   * left it at that. Writing the test for it showed what happens when the type is bypassed — a
   * JavaScript caller, a widened signature, an `as any` in a hurry: the template renders with
   * `{{inquiry_id}}` substituted by the empty string, and the customer gets a perfectly ordinary
   * message with a blank Inquiry ID. Nothing throws, nothing logs, and the handoff is untraceable
   * back to the row that was supposedly persisted first. That is the D1 failure exactly, arriving
   * through the one door the type does not cover.
   */
  if (typeof input.inquiryId !== 'string' || input.inquiryId.trim() === '') {
    throw new Error(
      'buildHandoffUrl requires the id of an inquiry that has already been persisted; ' +
        'use buildDirectContactUrl for a chat that carries no enquiry',
    )
  }

  const values: TokenValues = { ...input.values, inquiry_id: input.inquiryId }

  const result = shorten(
    input.template,
    values,
    (candidate) => renderTemplate(input.template, input.body, candidate),
    prefixLength(input.number),
    undefined,
    // The BODY, so the ladder's first rung can tell "City:" with an empty token from "City:" an
    // editor typed. After substitution the two are identical text.
    input.body,
  )

  // The shortener already rendered — and, from level 1 up, dropped the lines whose tokens resolved
  // to nothing. Re-rendering here would put those lines back, which is the bug this comment exists
  // to stop somebody reintroducing while tidying.
  return {
    url: urlFor(result.message, input.number),
    message: result.message,
    overLimit: result.overLimit,
    level: result.level,
  }
}

/**
 * The three chrome surfaces that may open a chat without an inquiry.
 *
 * A CLOSED UNION, NOT A `string`. The phase document lists exactly these three and says "Nowhere
 * else"; a free-text `source` would make that a comment, and this makes it a compile error.
 */
export type DirectContactSource = 'announcement' | 'footer' | 'contact-page'

export type DirectContactInput = {
  readonly source: DirectContactSource
  /**
   * The greeting, from `global_content` (`WHATSAPP_TEMPLATE.direct`). Passed rather than read so
   * this stays a pure function — and so that a caller with no string renders no link at all,
   * rather than a link to a chat that opens with a sentence a developer wrote.
   */
  readonly greeting: string
}

/**
 * A chat with a greeting and nothing else.
 *
 * `source` DOES NOT APPEAR IN THE MESSAGE. It exists to constrain the call sites and to give a
 * later analytics phase something to attribute; putting it in the text would send the customer a
 * message containing an internal identifier, which is precisely what the template allowlist exists
 * to prevent one line up.
 */
export function buildDirectContactUrl(input: DirectContactInput): string {
  return urlFor(input.greeting)
}
