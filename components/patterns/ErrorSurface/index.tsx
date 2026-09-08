import * as React from 'react'

import { Container } from '@/components/primitives/Container'
import { Heading } from '@/components/primitives/Heading'
import { Section } from '@/components/primitives/Section'
import { Text } from '@/components/primitives/Text'

/**
 * The shared presentation of the 404 and 500 surfaces (SEED §45 and §46).
 *
 * IT CONSUMES NO MEDIA, AND THAT IS THE WHOLE DESIGN. These are the two screens most likely to be
 * rendered while something is broken, and the most probable broken thing is media delivery. A 500
 * page with a hero image is a 500 page that may not render at all — so this is tokens, type and
 * nothing else. `tests/e2e/site-shell.spec.ts` asserts zero image requests on both.
 *
 * IT HOLDS NO WORDS. Every string is a prop, and every prop is nullable: a caller that could not
 * read a string renders that element not at all rather than a placeholder. There is no default
 * heading here, because a default would be a sentence nobody wrote appearing on the public site at
 * the exact moment nobody is watching.
 *
 * IT IS NEITHER A SERVER NOR A CLIENT COMPONENT. No directive, no hooks, no fetch — so the 404
 * surface can render it from a Server Component and the error boundary, which Next requires to be
 * a Client Component, can render the same markup without a second implementation drifting from it.
 */

export type ErrorSurfaceAction = {
  readonly label: string
  /** A destination, or a callback. Exactly one — `reset` has no href and a link has no handler. */
  readonly href?: string
  readonly onClick?: () => void
}

export type ErrorSurfaceProps = {
  readonly eyebrow?: string | null
  readonly heading: string | null
  readonly body?: string | null
  /** Rendered in order; the first is the primary. */
  readonly actions?: readonly ErrorSurfaceAction[]
  /** `error.digest` — the only thing that correlates this screen with a server log. */
  readonly reference?: string | null
  readonly referenceLabel?: string | null
}

export function ErrorSurface({
  eyebrow = null,
  heading,
  body = null,
  actions = [],
  reference = null,
  referenceLabel = null,
}: ErrorSurfaceProps): React.ReactElement {
  return (
    <Section>
      <Container size="prose">
        {eyebrow === null ? null : (
          <Text size="xs" tone="tertiary" uppercase className="tracking-eyebrow">
            {eyebrow}
          </Text>
        )}

        {/*
         * `level={1}` because this IS the page. A 404 rendered inside the site layout is still a
         * document whose subject is the missing page, and a page with no h1 — or with two — is
         * what the site-shell test checks for at every width.
         */}
        {heading === null ? null : (
          <Heading level={1} size="display-md" className="mt-3">
            {heading}
          </Heading>
        )}

        {body === null ? null : (
          <Text tone="secondary" className="mt-4">
            {body}
          </Text>
        )}

        {actions.length === 0 ? null : (
          <div className="mt-8 flex flex-wrap gap-6">
            {actions.map((action) =>
              action.href === undefined ? (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="rounded-sm text-ink underline underline-offset-4"
                >
                  {action.label}
                </button>
              ) : (
                <a
                  key={action.label}
                  href={action.href}
                  className="rounded-sm text-ink underline underline-offset-4"
                >
                  {action.label}
                </a>
              ),
            )}
          </div>
        )}

        {/*
         * The digest, never `error.message`. In production Next replaces the message with this
         * digest; in development it does not — so a developer grows used to seeing the real text
         * and the day a message contains a row's contents or a connection string, it renders on a
         * visitor's screen. The digest is the only part a reader can act on anyway.
         */}
        {reference === null ? null : (
          <Text size="xs" tone="tertiary" className="mt-8">
            {referenceLabel === null ? null : <>{referenceLabel} </>}
            <code>{reference}</code>
          </Text>
        )}
      </Container>
    </Section>
  )
}
