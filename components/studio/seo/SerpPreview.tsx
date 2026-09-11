'use client'

import * as React from 'react'
import { useState } from 'react'

import { Input } from '@/components/primitives/Input'
import { Label } from '@/components/primitives/Label'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { Textarea } from '@/components/primitives/Textarea'

/**
 * RC-348 `SerpPreview` — the title and description inputs with a live character count and a
 * search-result preview at the 60 / 155 marks.
 *
 * GUIDANCE, NOT ENFORCEMENT. The counts turn to a warning past the mark and the preview shows
 * where a result would cut, and the form saves whatever was typed: a title is editorial, and an
 * engineer's cap is not a reason to reject the owner's sentence. The Server Action does not check
 * length either — the two agree by both declining to.
 *
 * A CLIENT ISLAND FOR ONE REASON: the count and the preview follow the keystroke. It OWNS the two
 * inputs (named `title` and `description`, so the surrounding Server Action form reads them as
 * plain fields) rather than listening to inputs rendered elsewhere, which would tie it to the
 * DOM around it. Everything it shows is derived from its own state and the props it was given.
 */

export const TITLE_MARK = 60
export const DESCRIPTION_MARK = 155

export interface SerpPreviewLabels {
  readonly title: string
  readonly description: string
  readonly titleHelp: string
  readonly descriptionHelp: string
  readonly previewHeading: string
  readonly characters: string
  readonly overMark: string
  readonly resolvedFallback: string
}

function cut(value: string, mark: number): string {
  if (value.length <= mark) return value
  const head = value.slice(0, mark)
  const space = head.lastIndexOf(' ')
  return `${space > 0 ? head.slice(0, space) : head}…`
}

export function SerpPreview({
  initialTitle,
  initialDescription,
  /** What the ladder resolves to when the field is empty, shown in the preview rather than blank. */
  fallbackTitle,
  fallbackDescription,
  /** `%s | Rivya Living Art`, applied in the preview exactly as `lib/seo/metadata.ts` applies it. */
  template,
  url,
  labels,
  disabled,
}: {
  readonly initialTitle: string
  readonly initialDescription: string
  readonly fallbackTitle: string | null
  readonly fallbackDescription: string | null
  readonly template: string | null
  readonly url: string
  readonly labels: SerpPreviewLabels
  readonly disabled?: boolean
}): React.ReactElement {
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)

  const shownTitle = title.trim() === '' ? (fallbackTitle ?? '') : title.trim()
  const templated =
    template === null || shownTitle === '' ? shownTitle : template.replace('%s', shownTitle)
  const shownDescription =
    description.trim() === '' ? (fallbackDescription ?? '') : description.trim()
  const usingFallback = title.trim() === '' || description.trim() === ''

  const count = (value: string, mark: number): React.ReactElement => (
    <Text
      as="span"
      size="xs"
      tone={value.length > mark ? 'primary' : 'tertiary'}
      data-serp-count={value.length > mark ? 'over' : 'within'}
    >
      {String(value.length)} / {String(mark)} {labels.characters}
      {value.length > mark ? ` — ${labels.overMark}` : ''}
    </Text>
  )

  return (
    <div className="grid gap-4" data-serp-preview="">
      <div className="grid gap-1">
        <Label htmlFor="seo-title">{labels.title}</Label>
        <Input
          id="seo-title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={disabled}
          aria-describedby="seo-title-help"
        />
        <div className="flex flex-wrap justify-between gap-2">
          <Text as="span" size="xs" tone="tertiary" id="seo-title-help">
            {labels.titleHelp}
          </Text>
          {count(title, TITLE_MARK)}
        </div>
      </div>

      <div className="grid gap-1">
        <Label htmlFor="seo-description">{labels.description}</Label>
        <Textarea
          id="seo-description"
          name="description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={disabled}
          aria-describedby="seo-description-help"
        />
        <div className="flex flex-wrap justify-between gap-2">
          <Text as="span" size="xs" tone="tertiary" id="seo-description-help">
            {labels.descriptionHelp}
          </Text>
          {count(description, DESCRIPTION_MARK)}
        </div>
      </div>

      <Surface level={1} className="grid gap-1 p-4" aria-live="polite" data-serp-result="">
        <Text size="2xs" uppercase tone="tertiary">
          {labels.previewHeading}
          {usingFallback ? ` — ${labels.resolvedFallback}` : ''}
        </Text>
        <Text size="xs" tone="tertiary">
          {url}
        </Text>
        <Text size="md" data-serp-title="">
          {cut(templated, TITLE_MARK + 10)}
        </Text>
        <Text size="sm" tone="secondary" data-serp-description="">
          {cut(shownDescription, DESCRIPTION_MARK)}
        </Text>
      </Surface>
    </div>
  )
}
