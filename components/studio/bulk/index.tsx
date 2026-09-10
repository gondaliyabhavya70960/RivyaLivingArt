'use client'

import * as React from 'react'

import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import { cn } from '@/lib/ui/cn'

/**
 * The five bulk controls the phase document names, in one module.
 *
 * ONE FILE BECAUSE THEY ARE ONE CONVERSATION. `SelectionBar` says what is selected, `PreviewTable`
 * says what would happen, `ConfirmDestructive` asks whether you meant it, `OperationResult` says
 * what did happen and `UndoBanner` offers to reverse it. Splitting five twenty-line components
 * across five files would spread one flow over five imports without making any of them clearer.
 *
 * THE TYPED-COUNT CONFIRMATION LIVES HERE AND IS ALSO ENFORCED SERVER-SIDE. In this component it
 * disables a button; in `lib/bulk/run.ts` it refuses the request. The second is the gate — a
 * Server Action is an HTTP endpoint — and this is the part that makes an operator stop and read
 * the number. Both are needed: without the server check the dialog is decoration, and without the
 * dialog the operator never pauses.
 */

export interface PreviewRow {
  readonly entityId: string
  readonly outcome: 'APPLY' | 'SKIP' | 'INVALID'
  readonly reason?: string
  readonly rule?: string
  readonly label?: string
}

export function SelectionBar({
  selectedCount,
  maxSelection,
  children,
}: {
  readonly selectedCount: number
  readonly maxSelection: number
  readonly children?: React.ReactNode
}): React.ReactElement | null {
  if (selectedCount === 0) return null

  const overCap = selectedCount > maxSelection

  return (
    <div
      className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-4 border-t border-line bg-surface-raised p-4"
      data-selection-bar
    >
      <Text>
        {selectedCount} {t('studio.bulk.selected')}
      </Text>
      {overCap ? (
        // REPORTED WITH THE COUNT, which is what an operator needs in order to narrow the filter.
        // The engine refuses it as well; this is so they find out before they press anything.
        <Text tone="secondary" data-selection-over-cap>
          {t('studio.bulk.overCap')} {maxSelection}
        </Text>
      ) : (
        children
      )}
    </div>
  )
}

const OUTCOME_TONE: Record<PreviewRow['outcome'], 'neutral' | 'warning' | 'danger'> = {
  APPLY: 'neutral',
  SKIP: 'neutral',
  INVALID: 'danger',
}

export function PreviewTable({
  rows,
}: {
  readonly rows: readonly PreviewRow[]
}): React.ReactElement {
  const applying = rows.filter((row) => row.outcome === 'APPLY').length
  const skipping = rows.filter((row) => row.outcome === 'SKIP').length
  const invalid = rows.filter((row) => row.outcome === 'INVALID').length

  return (
    <Stack gap={4}>
      <div className="flex flex-wrap gap-3" data-preview-counts>
        <Badge tone="neutral">{`${applying} ${t('studio.bulk.willApply')}`}</Badge>
        <Badge tone="neutral">{`${skipping} ${t('studio.bulk.willSkip')}`}</Badge>
        <Badge tone={invalid > 0 ? 'danger' : 'neutral'}>
          {`${invalid} ${t('studio.bulk.willFail')}`}
        </Badge>
      </div>

      {/* A TABLE, and it scrolls rather than paginating: five hundred rows is the cap and an
          operator scanning for the excluded ones should not have to page through them. */}
      <div className="max-h-96 overflow-y-auto border border-line">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t('studio.bulk.previewCaption')}</caption>
          <thead className="sticky top-0 bg-surface-raised">
            <tr>
              <th scope="col" className="p-2 text-left">
                {t('studio.bulk.columnRow')}
              </th>
              <th scope="col" className="p-2 text-left">
                {t('studio.bulk.columnOutcome')}
              </th>
              <th scope="col" className="p-2 text-left">
                {t('studio.bulk.columnReason')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.entityId}
                className="border-t border-line"
                data-preview-row={row.entityId}
                data-preview-outcome={row.outcome}
              >
                <td className="p-2">{row.label ?? row.entityId}</td>
                <td className="p-2">
                  <Badge tone={OUTCOME_TONE[row.outcome]}>{row.outcome}</Badge>
                </td>
                {/* The RULE beside the reason, because "Not ready: Hero image, SEO" is what the
                    operator acts on and `publication_readiness` is what they quote in a bug. */}
                <td className="p-2 text-ink-secondary">
                  {row.reason ?? ''}
                  {row.rule === undefined ? null : (
                    <span className="ml-2 text-xs uppercase tracking-technical">{row.rule}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Stack>
  )
}

/**
 * The destructive confirmation: type the row count as digits.
 *
 * WHY A COUNT RATHER THAN THE WORD "ARCHIVE". Typing a fixed word becomes muscle memory within a
 * week. Typing the NUMBER OF ROWS cannot: it is different every time, it is the one fact the
 * operator most needs to have registered, and getting it wrong means they were not looking at the
 * preview.
 */
export function ConfirmDestructive({
  expectedCount,
  actionLabel,
  fieldName = 'typed_count',
  children,
}: {
  readonly expectedCount: number
  readonly actionLabel: string
  /**
   * The form field the typed number is submitted as.
   *
   * A REAL FIELD AND A REAL SUBMIT BUTTON, which the first draft of this component was not: it
   * took an `onConfirm` callback and tried to `requestSubmit()` a form it held a ref to. Inside
   * `ActionForm` that ref is never populated, so the button did nothing — and worse, it would have
   * meant the number reaching the server came from component state rather than from the form the
   * operator filled in. As a plain field it submits with everything else and works with no
   * JavaScript at all; the disabled button is the enhancement.
   */
  readonly fieldName?: string
  readonly children?: React.ReactNode
}): React.ReactElement {
  const inputId = React.useId()
  const [typed, setTyped] = React.useState('')
  const matches = typed.trim() === String(expectedCount)

  return (
    <Stack gap={3}>
      <Text tone="secondary">
        {t('studio.bulk.confirmPrompt')} {expectedCount}
      </Text>
      {children}
      <label htmlFor={inputId} className="text-sm">
        {t('studio.bulk.confirmLabel')}
      </label>
      <input
        id={inputId}
        name={fieldName}
        inputMode="numeric"
        // `pattern` and `inputMode` rather than `type="number"`: a spinner on a confirmation field
        // invites arrowing to the right answer without reading it.
        pattern="[0-9]*"
        autoComplete="off"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        className="w-32 border border-line bg-surface px-3 py-2 text-sm"
        data-confirm-count
      />
      <button
        type="submit"
        disabled={!matches}
        className={cn(
          'self-start border px-4 py-2 text-sm uppercase tracking-technical',
          matches ? 'border-ink text-ink' : 'cursor-not-allowed border-line text-ink-secondary',
        )}
        data-confirm-destructive
      >
        {actionLabel}
      </button>
    </Stack>
  )
}

export function OperationResult({
  status,
  applied,
  skipped,
  failed,
  problems,
}: {
  readonly status: string
  readonly applied: number
  readonly skipped: number
  readonly failed: number
  readonly problems: ReadonlyArray<{ entityId: string; reason: string }>
}): React.ReactElement {
  return (
    <Stack gap={3} data-operation-result={status}>
      <div className="flex flex-wrap gap-3">
        <Badge tone={status === 'SUCCEEDED' ? 'neutral' : 'danger'}>{status}</Badge>
        <Badge tone="neutral">{`${applied} ${t('studio.bulk.applied')}`}</Badge>
        <Badge tone="neutral">{`${skipped} ${t('studio.bulk.skipped')}`}</Badge>
        <Badge
          tone={failed > 0 ? 'danger' : 'neutral'}
        >{`${failed} ${t('studio.bulk.failed')}`}</Badge>
      </div>

      {/* EVERY PROBLEM IS LISTED BY ID, never summarised as a count. "3 failed" tells an operator
          to go looking; the ids tell them where. */}
      {problems.length === 0 ? null : (
        <ul className="list-none border border-line" data-operation-problems>
          {problems.map((problem) => (
            <li key={problem.entityId} className="border-b border-line p-2 text-sm">
              <span className="text-ink-secondary">{problem.entityId}</span>
              <span className="ml-3">{problem.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </Stack>
  )
}

/**
 * The undo offer.
 *
 * ITS BUTTON IS A SUBMIT, not an `onClick` handler, so the banner works inside the form it sits in
 * and before any JavaScript arrives. The same correction `ConfirmDestructive` needed: a control
 * whose only path runs in the browser is a control that fails silently when the bundle does.
 */
export function UndoBanner({
  deadlineAt,
  pending = false,
}: {
  readonly deadlineAt: string | null
  readonly pending?: boolean
}): React.ReactElement | null {
  if (deadlineAt === null) return null
  const expired = new Date(deadlineAt) < new Date()
  if (expired) return null

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 border border-line bg-surface-raised p-4"
      data-undo-banner
    >
      <Text>{t('studio.bulk.undoAvailable')}</Text>
      <button
        type="submit"
        disabled={pending}
        className="border border-ink px-4 py-2 text-sm uppercase tracking-technical disabled:cursor-not-allowed disabled:border-line"
        data-undo-submit
      >
        {t('studio.bulk.undo')}
      </button>
    </div>
  )
}
