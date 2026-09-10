import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { ActionForm } from '@/components/studio/ActionForm'
import type { StudioFormAction } from '@/components/studio/form-state'
import { t } from '@/components/studio/strings'
import type { Suggestion } from '@/lib/relations/rules'

/**
 * The two row shapes the workspace draws. Server Components — every control is a form.
 *
 * A FORM PER ROW, NOT A CLIENT LIST WITH HANDLERS. Accept, Dismiss and Remove are each one POST to
 * a Server Action, so the page needs no client state at all and every control works before any
 * JavaScript arrives. `ActionForm` is the one client boundary and it exists to show the refusal
 * message in place rather than to make the button work.
 */

export function RelationRow({
  id,
  relationType,
  targetLabel,
  targetType,
  origin,
  ruleKey,
  reciprocal,
  canWrite,
  removeAction,
}: {
  readonly id: string
  readonly relationType: string
  readonly targetLabel: string
  readonly targetType: string
  readonly origin: 'EDITOR' | 'RULE_ACCEPTED'
  readonly ruleKey: string | null
  readonly reciprocal: boolean
  readonly canWrite: boolean
  readonly removeAction: StudioFormAction
}) {
  return (
    <li
      className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-3"
      data-relation-id={id}
      data-relation-origin={origin}
    >
      <Stack gap={1}>
        <Text>{targetLabel}</Text>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{relationType}</Badge>
          <Badge tone="neutral">{targetType}</Badge>
          {/* The inverse indicator. A two-way edge deletes in both directions, so an editor about
              to remove one should be able to see that before they press it, not after. */}
          {reciprocal ? <Badge tone="neutral">{t('studio.relationships.inverse')}</Badge> : null}
          {/* Which rule proposed it, when one did. This is what makes `origin` auditable by a
              person rather than only by a query. */}
          {origin === 'RULE_ACCEPTED' ? (
            <Badge tone="neutral">{`${t('studio.relationships.fromRule')}${ruleKey === null ? '' : `: ${ruleKey}`}`}</Badge>
          ) : null}
        </div>
      </Stack>

      {canWrite ? (
        <ActionForm action={removeAction}>
          <input type="hidden" name="relation_id" value={id} />
          <input type="hidden" name="relation_table" value="product_relations" />
          <button type="submit" className="border border-line px-3 py-1 text-sm">
            {t('studio.relationships.remove')}
          </button>
        </ActionForm>
      ) : null}
    </li>
  )
}

export function SuggestionRow({
  sourceId,
  suggestion,
  reason,
  canWrite,
  acceptAction,
  dismissAction,
}: {
  readonly sourceId: string
  readonly suggestion: Suggestion
  readonly reason: string | null
  readonly canWrite: boolean
  readonly acceptAction: StudioFormAction
  readonly dismissAction: StudioFormAction
}) {
  return (
    <li
      className="flex flex-wrap items-start justify-between gap-4 border-b border-line py-3"
      data-suggestion-rule={suggestion.ruleKey}
      data-suggestion-target={suggestion.targetId}
    >
      <Stack gap={1}>
        <Text>{suggestion.targetTitle}</Text>
        {reason === null ? null : (
          <Text size="sm" tone="secondary">
            {reason}
          </Text>
        )}
        {/* What the rule actually observed, so an editor can check its working rather than trust
            it. A suggestion with no evidence is a recommendation, and this is not that. */}
        {suggestion.evidence.length === 0 ? null : (
          <div className="flex flex-wrap gap-2">
            {suggestion.evidence.map((item) => (
              <Badge key={item} tone="neutral">
                {item}
              </Badge>
            ))}
          </div>
        )}
      </Stack>

      {canWrite ? (
        <div className="flex gap-2">
          <ActionForm action={acceptAction}>
            <input type="hidden" name="source_type" value="product" />
            <input type="hidden" name="source_id" value={sourceId} />
            <input type="hidden" name="target_type" value={suggestion.targetType} />
            <input type="hidden" name="target_id" value={suggestion.targetId} />
            <input type="hidden" name="relation_type" value={suggestion.relationType} />
            <input type="hidden" name="rule_key" value={suggestion.ruleKey} />
            <button type="submit" className="border border-ink px-3 py-1 text-sm">
              {t('studio.relationships.accept')}
            </button>
          </ActionForm>
          <ActionForm action={dismissAction}>
            <input type="hidden" name="source_type" value="product" />
            <input type="hidden" name="source_id" value={sourceId} />
            <input type="hidden" name="target_type" value={suggestion.targetType} />
            <input type="hidden" name="target_id" value={suggestion.targetId} />
            <input type="hidden" name="rule_key" value={suggestion.ruleKey} />
            <button type="submit" className="border border-line px-3 py-1 text-sm">
              {t('studio.relationships.dismiss')}
            </button>
          </ActionForm>
        </div>
      ) : null}
    </li>
  )
}
