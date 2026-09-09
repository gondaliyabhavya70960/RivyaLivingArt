'use client'

import * as React from 'react'

import { Button } from '@/components/primitives/Button'
import { Cluster } from '@/components/primitives/Cluster'
import { ErrorText } from '@/components/primitives/ErrorText'
import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { buildStepSchema, type ResolvedForm } from '@/lib/cms/forms'

import { ConfiguratorProgress } from './Progress'
import { ConfiguratorReview } from './Review'
import { ConfiguratorStepView } from './Step'
import type { ConfiguratorCopy, ConfiguratorDefinition, UploadLimits } from './types'

export type { ConfiguratorCopy, ConfiguratorDefinition, UploadLimits } from './types'

/**
 * The bespoke brief: one step per screen, validated as the visitor goes.
 *
 * THIS COMPONENT ASKS NO QUESTION OF ITS OWN. Every step title, field label, option and help
 * sentence comes from `customization_form_steps` and `customization_form_fields`; every word of
 * chrome comes from `global_content`. There is not one visitor-readable literal in this file, which
 * is what FEAT §15's "every step configurable from Studio" actually requires and what
 * `scripts/cms/check-section-copy.ts` enforces.
 *
 * VALIDATION IS GENERATED FROM THE SAME ROWS. `buildStepSchema` turns a step's field rows into a Zod
 * object, so what the form accepts cannot drift from what it asks. A hand-written schema per
 * template would be a second description of the form, correct on the day it was written and wrong
 * the first time an editor made a field optional.
 *
 * THE DRAFT LIVES IN `sessionStorage` AND NOWHERE ELSE. D1 forbids customer accounts, so there is no
 * identity to hang a server-side draft on and no row to write it to. `sessionStorage` rather than
 * `localStorage`: a brief is a session's work, and a half-finished enquiry sitting in a shared
 * browser for a month is a privacy problem nobody asked for. The key carries a VERSION, so changing
 * the stored shape retires old drafts instead of feeding a stale one to a schema that has moved on.
 *
 * `?step=` IS THE ADDRESS OF A SCREEN, and that is what makes browser Back work. The step key —
 * not its index — is in the URL, so a link survives an editor reordering the form, and a
 * disabled-then-re-enabled step does not silently become a different screen. History is pushed on
 * each move, so Back goes to the previous step rather than off the page entirely.
 *
 * NOTHING HERE SUBMITS. Phase 19 ends at a validated payload; persisting the inquiry and handing
 * off to WhatsApp is Phase 20, and D1 is explicit that the save must come first. The submit control
 * is rendered and disabled with no handler, so the shape of the ending is visible without a button
 * that would drop a visitor's brief on the floor.
 */

const DRAFT_KEY = 'rivya.configurator.v1'

export interface ConfiguratorProps {
  readonly definition: ConfiguratorDefinition
  /** The same form, in the shape `lib/cms/forms.ts` works in. Steps are already filtered to enabled. */
  readonly form: ResolvedForm
  readonly copy: ConfiguratorCopy
  readonly uploadLimits: UploadLimits
  /** From `?product=`, resolved server-side to a real product. Pre-fills the project type. */
  readonly prefill?: Readonly<Record<string, string>>
}

type Answers = Record<string, unknown>

function readDraft(): Answers {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed !== null && typeof parsed === 'object' ? (parsed as Answers) : {}
  } catch {
    // A private window, cleared storage, or a browser refusing it outright. A configurator that
    // throws because it could not read a draft is worse than one that starts empty.
    return {}
  }
}

export function Configurator({ definition, form, copy, uploadLimits, prefill }: ConfiguratorProps) {
  const steps = definition.steps
  const stepKeys = React.useMemo(() => steps.map((entry) => entry.step.key), [steps])

  const [index, setIndex] = React.useState(0)
  const [reviewing, setReviewing] = React.useState(false)
  const [answers, setAnswers] = React.useState<Answers>({})
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [summary, setSummary] = React.useState<string | null>(null)
  const headingRef = React.useRef<HTMLDivElement>(null)

  /**
   * Restore after mount, never during render.
   *
   * `sessionStorage` does not exist on the server, so reading it in the initial state would make
   * the server and the first client render disagree and React would discard the whole tree. The
   * prefill is applied UNDER the draft: a visitor who has already answered the project type has
   * overruled the link they arrived by.
   */
  React.useEffect(() => {
    const restored = { ...prefill, ...readDraft() }

    /*
     * `?step=` IS READ HERE, NOT ON THE SERVER, and that is what keeps the route's markup cacheable
     * per URL rather than per step. It also makes the deep link honest: the server renders the
     * brief from the beginning, and the client moves to the named step once it has the draft that
     * step's answers belong to.
     *
     * AN UNKNOWN KEY OPENS THE BRIEF AT THE START. A link to a step an editor has since disabled
     * should not produce a page that says nothing works.
     */
    const requested = new URLSearchParams(window.location.search).get('step')
    const found = requested === null ? -1 : stepKeys.indexOf(requested)

    // `startTransition` rather than a bare `setAnswers`. Restoring a draft is not urgent work — the
    // form is already interactive and correct without it — and marking it as such is also what stops
    // this being the cascading render an effect that sets state synchronously would cause.
    React.startTransition(() => {
      setAnswers(restored)
      if (requested === 'review') setReviewing(true)
      else if (found !== -1) setIndex(found)
    })
  }, [prefill, stepKeys])

  React.useEffect(() => {
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(answers))
    } catch {
      // Storage refused — a private window, or a quota. The brief still works for this visit; it
      // just will not survive a refresh, which is a degradation rather than a failure.
    }
  }, [answers])

  /** Browser Back and Forward move between steps, because each one has an address. */
  React.useEffect(() => {
    function onPop() {
      const key = new URLSearchParams(window.location.search).get('step')
      const found = key === null ? 0 : stepKeys.indexOf(key)
      setReviewing(key === 'review')
      setIndex(found === -1 ? 0 : found)
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
    }
  }, [stepKeys])

  function go(nextIndex: number, review: boolean) {
    const key = review ? 'review' : stepKeys[nextIndex]
    if (key !== undefined) {
      const url = new URL(window.location.href)
      url.searchParams.set('step', key)
      window.history.pushState(null, '', url)
    }
    setIndex(nextIndex)
    setReviewing(review)
    setErrors({})
    setSummary(null)
    // Move focus to the new step's heading. Without it a keyboard or screen-reader user presses
    // Continue and is left at the bottom of a screen that has entirely changed.
    window.requestAnimationFrame(() => {
      headingRef.current?.focus()
    })
  }

  function change(key: string, value: unknown) {
    setAnswers((current) => ({ ...current, [key]: value }))
    // The error clears as soon as the field is touched. Leaving it until the next Continue makes a
    // corrected field look wrong while the visitor is looking straight at it.
    setErrors((current) => {
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function advance() {
    const entry = steps[index]
    if (entry === undefined) return

    const result = buildStepSchema(entry).safeParse(answers)
    if (!result.success) {
      const next: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0]
        if (typeof key === 'string' && !(key in next)) next[key] = issue.message
      }
      setErrors(next)
      setSummary(copy.stepErrors)
      window.requestAnimationFrame(() => {
        headingRef.current?.focus()
      })
      return
    }

    if (index >= steps.length - 1) go(index, true)
    else go(index + 1, false)
  }

  const entry = steps[index]
  if (entry === undefined) return null

  return (
    <Stack gap={8}>
      <div ref={headingRef} tabIndex={-1} className="outline-none">
        {definition.introHeading === null ? null : (
          <Stack gap={2}>
            <Heading level={2}>{definition.introHeading}</Heading>
            {definition.introBody === null ? null : (
              <Text tone="secondary">{definition.introBody}</Text>
            )}
          </Stack>
        )}
      </div>

      <ConfiguratorProgress
        current={reviewing ? steps.length : index + 1}
        total={steps.length}
        label={copy.progressLabel}
        sentence={copy.progress}
      />

      {summary === null ? null : (
        // `role="alert"` rather than a visual banner alone: a visitor who pressed Continue and saw
        // nothing move needs to be told why, and the fields are further down the page.
        <div role="alert">
          <ErrorText>{summary}</ErrorText>
        </div>
      )}

      {reviewing ? (
        <ConfiguratorReview
          form={form}
          answers={answers}
          copy={copy}
          onEdit={(stepKey) => {
            const found = stepKeys.indexOf(stepKey)
            if (found !== -1) go(found, false)
          }}
        />
      ) : (
        <ConfiguratorStepView
          entry={entry}
          answers={answers}
          errors={errors}
          onChange={change}
          copy={copy}
          uploadLimits={uploadLimits}
        />
      )}

      <Cluster gap={3} align="center">
        {index > 0 || reviewing ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              go(reviewing ? steps.length - 1 : index - 1, false)
            }}
          >
            {copy.back}
          </Button>
        ) : null}

        {reviewing ? (
          /*
           * DISABLED, WITH NO HANDLER, AND THAT IS THE POINT.
           *
           * Phase 19 ends at a validated payload. D1 requires an inquiry to be PERSISTED before any
           * WhatsApp redirect, and persistence arrives in Phase 20 — so a working button here would
           * either drop the brief on the floor or hand the visitor to WhatsApp with nothing saved,
           * which is the exact failure the rule exists to prevent. Rendering it disabled shows the
           * shape of the ending; the whole configurator is behind a flag that Phase 20's exit
           * criteria switch on, so no visitor sees this before the button works.
           */
          <Button type="button" variant="primary" disabled>
            {copy.submit}
          </Button>
        ) : (
          <Button type="button" variant="primary" onClick={advance}>
            {copy.next}
          </Button>
        )}
      </Cluster>

      {copy.saved === '' ? null : (
        <Text size="sm" tone="secondary">
          {copy.saved}
        </Text>
      )}
    </Stack>
  )
}
