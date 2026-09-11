import { present } from './guard'

/**
 * `ContactPoint` — `/contact`, only when the `contact-details` section is VERIFIED.
 *
 * AN UNVERIFIED PHONE NUMBER IS THE CLEAREST CASE IN THE WHOLE ALLOWLIST. A number in structured
 * data is a number a search engine may dial from a result card; SEED §21 seeds the section with
 * no destination and the owner supplies one. Until the section says VERIFIED the node is null.
 * `address` is never emitted — there is no premises to verify — which is also why there is no
 * `LocalBusiness` anywhere on this site.
 *
 * The node is attached to the Organization by `@id` rather than restating the organisation, so
 * the two cannot disagree about the name.
 */

export type ContactPointJsonLd = {
  readonly '@type': 'ContactPoint'
  readonly email?: string
  readonly telephone?: string
  readonly url?: string
  readonly availableLanguage?: readonly string[]
}

export type ContactInput = {
  readonly verified: boolean
  readonly email: string | null
  readonly phone: string | null
  /** The contact page's own absolute URL. */
  readonly url: string | null
}

export function contactPointJsonLd(input: ContactInput): ContactPointJsonLd | null {
  if (!input.verified) return null
  const email = present(input.email)
  const telephone = present(input.phone)
  // A ContactPoint with nothing to contact is not a contact point.
  if (email === undefined && telephone === undefined) return null
  const url = present(input.url)
  return {
    '@type': 'ContactPoint',
    ...(email === undefined ? {} : { email }),
    ...(telephone === undefined ? {} : { telephone }),
    ...(url === undefined ? {} : { url }),
  }
}
