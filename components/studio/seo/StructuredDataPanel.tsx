import { Badge } from '@/components/primitives/Badge'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { t, type StudioStringKey } from '@/components/studio/strings'
import { forbiddenKeysIn } from '@/lib/seo/jsonld'
import type { StructuredDataType } from '@/lib/supabase/schemas/seo'

/**
 * RC-352 `StructuredDataPanel` — the allowlist, one row per type: where it is emitted, what its
 * gate is, whether the gate is open right now, and a read-only rendering of exactly what the
 * builder would emit for a chosen entity.
 *
 * THE RENDERING IS THE BUILDER'S OUTPUT, NOT A PREVIEW OF IT. The page calls the same function the
 * public route calls, with the same rows, and prints the result — so what an owner reads here is
 * byte-for-byte what a crawler would, and a gate that is closed shows as "nothing emitted" rather
 * than as a sketch of what would appear once it opens. `forbiddenKeysIn()` is run over the result
 * and its (always empty) answer is printed too, so the guard is visible where the output is.
 */

export type GateState = {
  readonly type: StructuredDataType
  readonly routeKey: StudioStringKey
  readonly gateKey: StudioStringKey
  /** `open` — emitting now; `closed` — the gate refuses today; `partial` — some rows pass. */
  readonly state: 'open' | 'closed' | 'partial'
  /** A count line, e.g. "2 of 30 products", already resolved copy. */
  readonly detail: string
}

export function StructuredDataPanel({
  gates,
  rendering,
}: {
  readonly gates: readonly GateState[]
  readonly rendering: { readonly label: string; readonly graph: object | null } | null
}) {
  const tone = (state: GateState['state']) =>
    state === 'open' ? 'success' : state === 'partial' ? 'warning' : 'neutral'
  return (
    <Stack gap={4} data-seo-structured="">
      <Text size="sm" tone="secondary">
        {t('studio.seo.structured.intro')}
      </Text>
      <Surface level={1} className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="px-4 pt-4 pb-2 text-left">
            <Text size="2xs" uppercase tone="tertiary">
              {t('studio.seo.structured.caption')}
            </Text>
          </caption>
          <thead>
            <tr>
              {[
                t('studio.seo.structured.colType'),
                t('studio.seo.structured.colRoute'),
                t('studio.seo.structured.colGate'),
                t('studio.seo.structured.colState'),
              ].map((header) => (
                <th key={header} scope="col" className="px-4 py-2 align-top">
                  <Text as="span" size="xs" tone="tertiary">
                    {header}
                  </Text>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gates.map((gate) => (
              <tr key={gate.type} data-seo-structured-type={gate.type} data-seo-gate={gate.state}>
                <td className="px-4 py-2 align-top">
                  <Text as="span" size="sm">
                    {gate.type}
                  </Text>
                </td>
                <td className="px-4 py-2 align-top">
                  <Text as="span" size="sm" tone="secondary">
                    {t(gate.routeKey)}
                  </Text>
                </td>
                <td className="px-4 py-2 align-top">
                  <Text as="span" size="sm" tone="secondary">
                    {t(gate.gateKey)}
                  </Text>
                </td>
                <td className="px-4 py-2 align-top">
                  <span className="grid gap-1">
                    <Badge tone={tone(gate.state)}>
                      {t(`studio.seo.structured.state.${gate.state}`)}
                    </Badge>
                    <Text as="span" size="xs" tone="tertiary">
                      {gate.detail}
                    </Text>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>

      <Text size="xs" tone="tertiary" data-seo-structured-never="">
        {t('studio.seo.structured.neverEmitted')}
      </Text>

      {rendering === null ? null : (
        <Surface level={1} className="grid gap-2 p-4" data-seo-structured-rendering="">
          <Text size="sm">{rendering.label}</Text>
          {rendering.graph === null ? (
            <Text size="sm" tone="secondary">
              {t('studio.seo.structured.nothingEmitted')}
            </Text>
          ) : (
            <>
              <pre className="overflow-x-auto text-xs">
                {JSON.stringify(rendering.graph, null, 2)}
              </pre>
              <Text size="xs" tone="tertiary">
                {t('studio.seo.structured.forbiddenCheck').replace(
                  '{{count}}',
                  String(forbiddenKeysIn(rendering.graph).length),
                )}
              </Text>
            </>
          )}
        </Surface>
      )}
    </Stack>
  )
}
